function log(msg) {
    console.log(msg)
}

//var wsurl = "ws://"+window.location.host+"/gmop";
var wsurl = "ws://localhost:20161/gmop";
var ws;
var vm;
var waiting_cmd;
var notebooks;

function find_notebook(guid) {
    for (var i=0; i<notebooks.length; ++i) {
        var nb = notebooks[i];
        if (nb.guid == guid) {
            return nb;
        }
    }
}

function find_note(nb, guid) {
    var notes = nb.notes;
    for (var i=0; i<notes.length; ++i) {
        var n = notes[i];
        if (n.guid == guid) {
            return n;
        }
    }
}

function req_notebookcount() {
    for (var i=0; i<notebooks.length; ++i) {
        var nb = notebooks[i];
        wssend("getnotecount", {guid: nb.guid});
    }
}

function req_notes(nb) {
    if (nb.__count) {
        wssend("getnotes", {guid: nb.guid, offset:0, count:nb.__count});
    }
}

function req_note(n) {
    wssend("getnote", {notebookguid:n.notebookguid, guid:n.guid});
}

var wshandler = {}

wshandler.auth = function(v) {
    //vm.onlogined(true, v);

    wssend("getnotebooks")
}

wshandler.getnotebooks = function(v) {
    log(v);
    refresh_notebooks(v);
}

wshandler.getnotecount = function(v) {
    var nbc = v.notebookCounts;
    for (var guid in nbc) {
        var nb = find_notebook(guid);
        if (nb) {
            nb.__count = nbc[guid];
            refresh_notebookcount(nb);
        } else {
            log("Not found notebook:"+guid);
        }
    }
}

wshandler.getnotes = function(v) {
    log("getnotes:"+v.guid);
    var nb = find_notebook(v.guid);
    if (nb) {
        log("refresh_notes");
        refresh_notes(nb, v.notes);
    }
}

wshandler.getnote = function(v) {
    var nb = find_notebook(v.notebookguid);
    if (nb) {
        var n = find_note(nb, v.guid);
        if (n) {
            n.content = v.content;
            vm.input = n.content;
        }
    }
}

function wscreate(user, passwd) {
    ws = new WebSocket(wsurl);
    ws.onopen = function() {
        log("open");
        wssend("auth", {user:user, passwd:passwd});
    }
    ws.onmessage = function(e) {
        var v = JSON.parse(e.data);
        log(v);
        if (v.cmd == waiting_cmd) {
            waiting_cmd = null
        } 
        var f = wshandler[v.id];
        if (f) {
            f(v.body)
        } else {
            log("Invalid msg: "+e.data)
        }
    }
    ws.onclose = function(e) {
        log("closed");
        //vm.onlogined(false)
    }
}
function wsclose() {
    if (ws) {
        ws.close()
    }
}
function wssend(msgid, body) {
    var v = {id: msgid, body: body||{}};
    ws.send(JSON.stringify(v))
}

wscreate("md", "123456");

function dom_notebookhead(nb, count) {
    var strcnt = "";
    if (count) {
        strcnt = '<span class="badge">'+count+'</span>'+
            '<i class="fa fa-fw fa-caret-down"></i>';
    }
    return ' '+nb.name+' '+strcnt;
}

function dom_notebook(nb) {
    var head = "notebookhead"+nb.name;
    var id = "notebook"+nb.name;
    var s = 
    '<a id="'+head+'" href="javascript:;" data-toggle="collapse" data-target="#'+id+'">'+
    dom_notebookhead(nb)+
    '</a>'+
    '<ul id="'+id+'" class="collapse">'+
    '</ul>'
    return s;
}

function dom_notetitle(n) {
    return '<a href="#">'+n.title+'</a>'
}

function refresh_notebooks(v) {
    notebooks = v;
    for (var i=0; i<notebooks.length; ++i) {
        notebooks[i].__index = i; // add __index
    }
    var ul = document.getElementById("notebooks");

    while(ul.hasChildNodes()) {
        ul.removeChild(ul.firstChild);
    }
    for (var i=0; i<notebooks.length; ++i) {
        var nb = notebooks[i];
        var li = document.createElement("li");
        li.innerHTML = dom_notebook(nb);//'<a href="#">'+nb.name+'</a>';
        ul.appendChild(li);
        li.__data = nb;
        li.onclick = function() {
            req_notes(this.__data);
        }
    }
    req_notebookcount();
}

function refresh_notebookcount(nb) {
    var head = document.getElementById("notebookhead"+nb.name);
    if (head) {
        head.innerHTML = dom_notebookhead(nb, nb.__count);
    }
}

function refresh_notes(nb, notes) {
    nb.notes = notes;
    for (var i=0; i<notes.length; ++i) {
        var n = notes[i];
        n.notebookguid = nb.guid;
    }
    var ul = document.getElementById("notebook"+nb.name);
    while(ul.hasChildNodes()) {
        ul.removeChild(ul.firstChild);
    }
    for (var i=0; i<notes.length; ++i) {
        var n = notes[i];
        var li = document.createElement("li");
        li.innerHTML = dom_notetitle(n);//'<a href="#">'+nb.name+'</a>';
        ul.appendChild(li);
        li.__data = n;
        li.onclick = function() {
            req_note(this.__data);
        }
    }
}

marked.setOptions({
    highlight: function (code) {
        return hljs.highlightAuto(code).value;
    }
});

var test=enml.PlainTextOfENML('<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">\n<en-note style="word-wrap: break-word; -webkit-nbsp-mode: space; -webkit-line-break: after-white-space;"><div>Hello</div>\n<div>World!!</div>\n</en-note>');
var test=enml.HTMLOfENML('<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd">\n<en-note style="word-wrap: break-word; -webkit-nbsp-mode: space; -webkit-line-break: after-white-space;"><div>Hello</div>\n<div>World!!</div>\n</en-note>');

vm = new Vue({
    el: 'body',
    data: {
        input: test,
        notebooks: [],
    },
    filters: {
        marked: marked
    }
})

var md_value = "";
function check_md_change() {
    var md = document.getElementById("md-content");
    if (md.value != md_value) {
        md_value = md.value;

        marked(md_value, function (err, content) {
            if (!err) {
                var r = document.getElementById("md-render");
                r.innerHTML = content;
                console.log(md.scrollTop+" "+md.scrollHeight);
                if (md.scrollTop == md.scrollHeight) {
                    r.scrollTop = r.scrollHeight;
                }
            }
        });
    }
}

$(document).ready(function() {
    $("#wrapper").toggleClass("toggled");
    $("#menu-toggle").click(function(e) {
        $("#wrapper").toggleClass("toggled");
    });
    //$("#md-content").change(function() {
    //    log("value changed");
    //});
    setInterval("check_md_change()", 1000);
    $("#md-content").on("focus", function() {
        $("#wrapper").toggleClass("toggled", true);
    });
});
