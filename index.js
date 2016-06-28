function log(msg) {
    console.log(msg)
}
var editor;
var defnotebookname = "blog";
//var wsurl = "ws://"+window.location.host+"/gmop";
var wsurl = "ws://localhost:20161/gmop";
var ws;
var logined = false;
var req_waiting = {};
var notebooks;
var editnotebook;
var edit;
var pending_id = 0;
var pending_notes = {};
var last_sync = false;
var tick = 0;

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
req.updatenote = function(n) {
    wssend("updatenote", {guid:n.guid, title:n.title, content:n.content});
}
req.createnote = function(n) {
    wssend("createnote", {guid:n.guid, title:n.title, content:n.content,
        notebookguid:n.notebook.guid});
}
for (var key in req) {
    var func = req[key];
    req[key] = function(key, func) {
        return function(v) {
            if (!req_waiting[key]) {
                req_waiting[key] = true;
                update_refresh_btn(true);
                func(v);
            } else {
            }
        }
    }(key, func);
}

// response
var res = {}
res.auth = function(v) {
    req_waiting = {}
    logined = true;
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
            note.edit(n);
        }
    }
}

res.updatenote = function(v) {
    var guid = v.guid;
    var n = pending_notes[guid];
    if (n) {
        delete pending_notes[guid];
    }
}

res.createnote = function(v) {
    var id = v.myguid
    var n = pending_notes[id];
    if (n) {
        delete pending_notes[id];
        delete n.nocreate;
        n.guid = v.guid;
        refresh_addnote(n.notebook, n);
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

var note = {}

note.hascontent = function(n) {
    return n.title != "" || n.content != ""
}
note.save = function(n) {
    if (!n) return false;
    if (!n.md_changed1 && !n.md_changed2) return false;
    if (n.md_changed1) {
        n.title = $("#md-title").val();
        n.md_changed1 = false;
    }
    if (n.md_changed2) {
        //var content = $("#md-content").val();
        content = editor.getValue();
        n.content = enml.ENMLOfPlainText(content);
        n.md_changed2 = false;
    }
    if (!n.title.match(/\S/)) {
        n.title = "Untitled"
    }
    if (!n.guid) {
        pending_id++;
        n.guid = pending_id;
        n.nocreate = true;
    } else {
        refresh_notetitle(n);
    }
    pending_notes[n.guid] = n;
    
    // todo check n.notebook, check ws
}
note.create = function() {
    var n = {
        notebook: editnotebook,
        title: "",
        content: ""
    }
    note.edit(n);
}
note.edit = function(n) {
    note.save(edit);
    edit = n;
    refresh_note(edit);
}
note.update = function() {
    if (!logined) return;
    if (req_waiting["updatenote"] ||
        req_waiting["createnote"]) {
        return;
    }
    for (var id in pending_notes) {
        var n = pending_notes[id];
        if (n.nocreate) {
            req.createnote(n);
        } else {
            req.updatenote(n);
        }
        break;
    }
}

function wscreate() {
    ws = new WebSocket(wsurl);
    ws.onopen = function() {
        log("open");

        var user = "md"; 
        var passwd = "123456";
        wssend("auth", {user:user, passwd:passwd});
    }
    ws.onmessage = function(e) {
        var v = JSON.parse(e.data);
        log(v);
        if (req_waiting[v.id]) {
            delete req_waiting[v.id];
        }
        var f = res[v.id];
        if (f) { // todo err:{code:?}
            f(v.body)
        } else {
            log("Invalid msg: "+e.data)
        }
    }
    ws.onclose = function(e) {
        log("closed");
        wsclose();
    }
}
function wsclose() {
    if (ws) {
        ws.close();
        delete ws;
        ws = null;
        logined = false;
        // don't clear, just keep waiting for other logic need (eg btn_refresh)
        //req_waiting = {}; 
    }
}
function wssend(msgid, body) {
    if (ws) {
        var v = {id: msgid, body: body||{}};
        ws.send(JSON.stringify(v))
    }
}

wscreate();

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

    while (ul.children.length > 1) {
        ul.removeChild(ul.children[1]);
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
    for (var id in pending_notes) {
        var n = pending_notes[id];
        if (n && !n.notebook) {
            n.notebook = editnotebook;
        }
    }
    if (!edit.notebook) {
        edit.notebook = editnotebook;
    }
}

function refresh_notebookcount(nb) {
    var head = document.getElementById("notebookhead"+nb.name);
    if (head) {
        head.innerHTML = dom_notebookhead(nb, nb.notecount);
    }
}

function dom_createnotetitle(n) {
    var li = document.createElement("li");
    li.innerHTML = dom_notetitle(n);//'<a href="#">'+nb.name+'</a>';
    li.__data = n;
    n.__dom = li;
    li.onclick = function() {
        var n = this.__data;
        if (!n.content) {
            req.getnote(n);
        } else {
            note.edit(n);
        }
    }
    return li;
}
function refresh_notes(nb, notes, start, count) {
    var ul = document.getElementById("notebook"+nb.name);
    while(ul.hasChildNodes()) {
        ul.removeChild(ul.firstChild);
    }
    for (var i=0; i<notes.length; ++i) {
        var n = notes[i];
        var li = dom_createnotetitle(n);
        ul.appendChild(li);
    }
    nb.reqnotecount = start+count;
}

function refresh_addnote(nb, n) {
    var ul = document.getElementById("notebook"+nb.name);
    var li = dom_createnotetitle(n);
    ul.insertBefore(li, ul.firstChild);
}

function refresh_notetitle(n) {
    n.__dom.innerHTML = dom_notetitle(n);
}

function refresh_render(content) {
    marked(content, function (err, content) {
        if (!err) {
            var r = document.getElementById("md-render");
            r.innerHTML = content;
        } else {
            log("md-render fail");
        }
    });
}
function refresh_note(n) {
    var value = enml.PlainTextOfENML(n.content);
    editor.setValue(value);
    refresh_render(editor.getValue());

    var t = document.getElementById("md-title");
    t.value = n.title;
}

marked.setOptions({
    highlight: function (code) {
        return hljs.highlightAuto(code).value;
    }
});

function update_refresh_btn(sync) {
    if (sync != last_sync) {
        last_sync = sync;
        if (sync) {
            $("#btn-refresh").attr("class", "btn fa fa-refresh fa-lg fa-spin");
        } else {
            $("#btn-refresh").attr("class", "btn fa fa-refresh fa-lg");
        }
    }
}
function update() {
    check_edit_content();
    note.update();

    var sync = false;
    for (var k in req_waiting) {
        sync = true;
        break;
    }

    if (tick%2 == 0) {
        update_refresh_btn(sync);
    }
    if (tick%6 == 0) {
        if (!ws) {
            wscreate();
        }
    }
    tick++;
}
function check_edit_content() {
    if (edit.content_changed) {
        edit.content_changed = false;
        //var c = document.getElementById("md-content");
        //refresh_render(c.value);
        refresh_render(editor.getValue());
    }
}

$(document).ready(function() {
    editor = ace.edit("md-content");
    editor.setTheme("ace/theme/twilight");
    editor.getSession().setMode("ace/mode/markdown");
    editor.getSession().setTabSize(4);
    editor.getSession().setUseSoftTabs(true);
    editor.getSession().setUseWrapMode(true);
    editor.setKeyboardHandler('ace/keyboard/vim');
    //editor.setHighlightActiveLine(false);
    
    $("#wrapper").toggleClass("toggled", false);
    $("#menu-toggle").click(function(e) {
        $("#wrapper").toggleClass("toggled");
    });
    $("#btn-refresh").attr("class", "btn fa fa-refresh fa-lg");
   
    editor.on("focus", function() {
    //$("#md-content").on("focus", function() {
        $("#wrapper").toggleClass("toggled", false);
    });
    $('#md-title').bind('input propertychange', function() {
        var v = $(this).val();
        edit.md_changed1 = true;
    });
    $('#md-content').bind('input propertychange', function() {
        var v = $(this).val();
        edit.content_changed = true;
        edit.md_changed2 = true;
    });
    $('#newnote').click(function(e) {
        note.create();
    });
    setInterval("update()", 500);
    note.create();});
