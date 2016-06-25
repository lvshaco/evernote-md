function log(msg) {
    console.log(msg)
}
var defnotebookname = "blog";
//var wsurl = "ws://"+window.location.host+"/gmop";
var wsurl = "ws://localhost:20161/gmop";
var ws;
var req_waiting = {};
var notebooks;
var editnotebook;
var edit = {notebook:null, title:"", content:""};

// request
var req = {}
req.getnotebooks = function() {
    if (!notebooks) {
        wssend("getnotebooks")
    }
}
//req.getnotecount = function() {
//    for (var i=0; i<notebooks.length; ++i) {
//        var nb = notebooks[i];
//        if (!nb.notecount) {
//            wssend("getnotecount", {guid: nb.guid});
//        }
//    }
//}
req.getnotes = function(nb) {
    wssend("getnotes", {guid: nb.guid, offset:0, count:nb.notecount});
}
req.getnote = function(n) {
    wssend("getnote", {notebookguid:n.notebookguid, guid:n.guid});
}
for (var key in req) {
    var func = req[key];
    req[key] = function(key, func) {
        return function(v) {
            if (!req_waiting[key]) {
                req_waiting[key] = true;
                func(v);
            } else {
            }
        }
    }(key, func);
}

// response
var res = {}
res.auth = function(v) {
    req.getnotebooks();
}
res.getnotebooks = function(v) {
    log(v);
    notebooks = v;
    refresh_notebooks();
}
res.getnotecount = function(v) {
    var nbc = v.notebookCounts;
    for (var guid in nbc) {
        var nb = find_notebook(guid);
        if (nb) {
            nb.notecount = nbc[guid];
            nb.reqnotecount = 0;
            refresh_notebookcount(nb);
        } else {
            log("Not found notebook:"+guid);
        }
    }
}
res.getnotes = function(v) {
    log("getnotes:"+v.guid);
    var nb = find_notebook(v.guid);
    if (nb) {
        log("refresh_notes");
        var notes = v.notes;
        nb.notes = notes;
        for (var i=0; i<notes.length; ++i) {
            var n = notes[i];
            n.notebookguid = nb.guid;
        }
        refresh_notes(nb, notes, v.startIndex, v.totalNotes);
    }
}
res.getnote = function(v) {
    var nb = find_notebook(v.notebookguid);
    if (nb) {
        var n = find_note(nb, v.guid);
        if (n) {
            n.content = v.content;
            refresh_note(n);
        }
    }
}

function find_notebook_byname(name) {
    for (var i=0; i<notebooks.length; ++i) {
        var nb = notebooks[i];
        if (nb.name == name) {
            return nb;
        }
    }
}
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

function savenote() {
    if (edit.title != "" || edit.content != "") {
    }
}
function createnote() {
    if (!editnotebook) {
        return;
    }
    savenote();
    edit.notebook = editnotebook;
    edit.title = "";
    edit.content = "";
    refresh_note(edit);
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
        if (req_waiting[v.id]) {
            req_waiting[v.id] = null;
        }
        var f = res[v.id];
        if (f) {
            f(v.body)
        } else {
            log("Invalid msg: "+e.data)
        }
    }
    ws.onclose = function(e) {
        log("closed");
    }
}
function wsclose() {
    if (ws) {
        ws.close();
        req_waiting = {};
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
    return '<i class="fa fa-book"></i> '+nb.name+' '+strcnt;
}

function dom_notebook(nb) {
    var head = "notebookhead"+nb.name;
    var id = "notebook"+nb.name;
    var s = 
    '<a id="'+head+'" href="javascript:;" data-toggle="collapse" data-target="#'+id+'">'+
    dom_notebookhead(nb)+
    '</a>'+
    '<ul id="'+id+'">'+// class="collapse">'+
    '</ul>'
    return s;
}

function dom_notetitle(n) {
    return '<a href="#">'+n.title+'</a>'
}

function dom_newnotetext(name) {
    return "在"+name+"中新建笔记";
}

function refresh_notebooks() {
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
            var nb = this.__data;
            if (nb.reqnotecount < nb.notecount) {
                req.getnotes(nb);
            }
        }
    }
    var ul = document.getElementById("sel_notebooks");
    while(ul.hasChildNodes()) {
        ul.removeChild(ul.firstChild);
    }
    for (var i=0; i<notebooks.length; ++i) {
        var nb = notebooks[i];
        var li = document.createElement("li");
        li.innerHTML = '<a href="#">'+dom_newnotetext(nb.name)+'</a>';
        ul.appendChild(li);
        li.__data = nb;
        li.onclick = function() {
            refresh_editnotebook(this.__data);
        }
    }
    if (!editnotebook) {
        var nb = find_notebook_byname(defnotebookname);
        if (!nb && notebooks.length>0) {
            nb = notebooks[0];
        }
        if (nb) {
            refresh_editnotebook(nb);
        }
    }
    //req.notebookcount();
}

function refresh_editnotebook(nb) {
    var btn = document.getElementById("newnote");
    btn.innerHTML = ' + '+dom_newnotetext(nb.name);
    editnotebook = nb;
}

function refresh_notebookcount(nb) {
    var head = document.getElementById("notebookhead"+nb.name);
    if (head) {
        head.innerHTML = dom_notebookhead(nb, nb.notecount);
    }
}

function refresh_notes(nb, notes, start, count) {
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
            var n = this.__data;
            if (!n.content) {
                req.getnote(n);
            } else {
                refresh_note(n);
            }
        }
    }
    nb.reqnotecount = start+count;
}

function refresh_render() {
    marked(edit.content, function (err, content) {
        if (!err) {
            var r = document.getElementById("md-render");
            r.innerHTML = content;
        }
    });
}
function refresh_note(n) {
    var c = document.getElementById("md-content");
    c.value = enml.PlainTextOfENML(n.content);
    var t = document.getElementById("md-title");
    t.value = n.title;
    refresh_render();
}

marked.setOptions({
    highlight: function (code) {
        return hljs.highlightAuto(code).value;
    }
});

function check_edit_content() {
    var md = document.getElementById("md-content");
    if (md.value != edit.content) {
        edit.content = md.value;
        refresh_render();
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
    setInterval("check_edit_content()", 500);
    $("#md-content").on("focus", function() {
        $("#wrapper").toggleClass("toggled", true);
    });
    $('#md-title').bind('input propertychange', function() {
        edit.title = $(this).val();
        console.log(edit.title);
    });
    $('#newnote').click(function(e) {
        createnote();
    });
});
