var config = require("./config");
var Evernote = require("evernote-sdk-js").Evernote;

var wshandler = {}
module.exports = wshandler;

wshandler.auth = function(ws, v, msgid) {
    if (ws.client) {
        return "Has Logined";
    }
    if (ws.logining) {
        return "Logining";
    }
    ws.logining = true
    var client = new Evernote.Client({
        token: config.token, 
        sandbox: config.sandbox, 
        china: config.ischina
    });

    var userStore = client.getUserStore();
    userStore.checkVersion(
        "Evernote-md",
        Evernote.EDAM_VERSION_MAJOR,
        Evernote.EDAM_VERSION_MINOR,
        function(err, versionOk) {
            ws.logining = null;
            console.log("Is my Evernote API version up to date? " + versionOk + " "+err);
            if (versionOk) {
                ws.sendJson(msgid, 0);
                ws.client = client;
            } else {
                ws.sendJson(msgid, "Evernote API Wrong");
            }
        }
    );
}

wshandler.logout = function(ws) {
    if (ws.client) {
        ws.client = null;
    }
}

wshandler.getnotebooks = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    noteStore.listNotebooks(function(err, notebooks) {
        console.log("listNotebooks:");
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "ListNotebooks Fail");
        } else {
            ws.sendJson(msgid, notebooks);
            for (var i=0; i<notebooks.length; ++i) {
                var nb = notebooks[i];
                setTimeout(function() {
                    wshandler.getnotecount(ws, {guid: this.guid}, 'getnotecount');
                }.bind(nb), 0);
            }
        }
    });
}

wshandler.getnotecount = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    var filter = new Evernote.NoteFilter();
    filter.notebookGuid = v.guid;
    filter.order = Evernote.NoteSortOrder.UPDATED;//CREATED;
    filter.ascending = false;

    noteStore.findNoteCounts(filter, false, function(err, counts) {
        console.log("findNoteCounts:"+v.guid);
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "findNoteCounts Fail");
        } else {
            console.log(counts);
            ws.sendJson(msgid, counts);
        }
    });
}

wshandler.getnotes = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    var filter = new Evernote.NoteFilter();
    filter.notebookGuid = v.guid;
    filter.order = Evernote.NoteSortOrder.CREATED;
    filter.ascending = false;

    var spec = new Evernote.NotesMetadataResultSpec();
    spec.includeTitle = true;
    spec.includeCreated = true;
    spec.includeUpdated= true;

    noteStore.findNotesMetadata(filter, v.offset, v.count, spec, function(err, notelist) {
        console.log("findNotesMetadata:");
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "findNotesMetadata Fail");
        } else {
            notelist.guid = v.guid;
            ws.sendJson(msgid, notelist);
        }
    });
}

wshandler.getnote = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    noteStore.getNoteContent(v.guid, function(err, note) {
        console.log("getNoteContent:");
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "getNoteContent Fail");
        } else {
            ws.sendJson(msgid, {notebookguid:v.notebookguid, guid:v.guid, content: note});
        }
    });
}

wshandler.updatenote = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    var note = new Evernote.Note();
    note.guid = v.guid;
    note.title = v.title;
    note.content = v.body;

    noteStore.updateNote(note, function(err, note) {
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "updateNote Fail");
        } else {
            ws.sendJson(msgid, {notebookguid:v.notebookguid, guid:v.guid});
        }
    });
}

wshandler.createnote = function(ws, v, msgid) {
    if (!ws.client) {
        return "No logined";
    }
    var client = ws.client;
    var noteStore = client.getNoteStore();

    var note = new Evernote.Note();
    note.notebookGuid = v.notebookguid;
    note.title = v.title;
    note.content = v.body;

    noteStore.createNote(note, function(err, note) {
        if (err) {
            console.log(err);
            ws.sendJson(msgid, "createNote Fail");
        } else {
            ws.sendJson(msgid, {notebookguid:v.notebookguid, guid:note.guid});
        }
    });
}
