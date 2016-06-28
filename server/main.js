var Evernote = require("evernote-sdk-js").Evernote;
var developerToken = "S=s53:U=c7d99f:E=15cd38e2d17:C=1557bdd0028:P=1cd:A=en-devtoken:V=2:H=dba8b1033a2b898bdf04785540735814";
//var developerToken = "S=s1:U=92a55:E=15cd3ae4608:C=1557bfd1700:P=1cd:A=en-devtoken:V=2:H=b649beb7496b0e4c977a6eff2995fbc8";

function findNotebook(notebooks, name) {
    for (var i in notebooks) {
        var b = notebooks[i];
        //console.log(b.name)
            if (b.name == name) {
                return b;
            }
    }
}

function makeNote(noteStore, noteTitle, noteBody, parentNotebook, callback) {

    var nBody = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>";
    nBody += "<!DOCTYPE en-note SYSTEM \"http://xml.evernote.com/pub/enml2.dtd\">";
    nBody += "<en-note>" + noteBody + "</en-note>";

    // Create note object
    var ourNote = new Evernote.Note();
    ourNote.title = noteTitle;
    ourNote.content = nBody;

    // parentNotebook is optional; if omitted, default notebook is used
    if (parentNotebook && parentNotebook.guid) {
        ourNote.notebookGuid = parentNotebook.guid;
    }

    // Attempt to create note in Evernote account
    noteStore.createNote(ourNote, function(err, note) {
        if (err) {
            // Something was wrong with the note data
            // See EDAMErrorCode enumeration for error code explanation
            // http://dev.evernote.com/documentation/reference/Errors.html#Enum_EDAMErrorCode
            console.log(err);
        } else {
            callback(note);
        }
    });

}


var isSandbox = false;
var isChina = true;
console.log("create client:");
var client = new Evernote.Client({token: developerToken, sandbox: isSandbox, china: isChina});
//console.log(client);

console.log("getUserStore:");
var userStore = client.getUserStore();
//console.log(userStore);

userStore.checkVersion(
        "Evernote EDAMTest (Node.js)",
        Evernote.EDAM_VERSION_MAJOR,
        Evernote.EDAM_VERSION_MINOR,
        function(err, versionOk) {
            console.log("Is my Evernote API version up to date? " + versionOk);
            console.log(err);
            if (!versionOk) {
                process.exit(1);
            }
        }
        );

console.log("getUser:");
userStore.getUser(function(err, user) {
    //console.log(err);
    //console.log(user);
    // run this code
});
// Set up the NoteStore client 
console.log("getNoteStore:");
var noteStore = client.getNoteStore();
//console.log(noteStore);

// List all of the notebooks in the user's account
noteStore.listNotebooks(function(err, notebooks) {
    console.log("listNotebooks: "+err);
    //console.log(notebooks);
    console.log("Found " + notebooks.length + " notebooks:");
    for (var i in notebooks) {
        // console.log(notebooks[i]);
        console.log("  * " + notebooks[i].name);
    }
    
    var mybook = findNotebook(notebooks, "blog");
    console.log(mybook.guid);
    makeNote(noteStore, "tile: test by md", "content: test by md", mybook, function(note) {
        console.log("make Node ok:");
        console.log(note);
    });
return;
    var filter = new Evernote.NoteFilter();
    filter.notebookGuid = mybook.guid;
    filter.order = Evernote.NoteSortOrder.CREATED;
    filter.ascending = false;

    noteStore.findNoteCounts(filter, false, function(err, counts) {
        console.log("findNoteCounts:");
        console.log(err);
        console.log(counts);
    });

    var spec = new Evernote.NotesMetadataResultSpec();
    spec.includeTitle = true;
    spec.includeCreated = true;
    spec.includeUpdated= true;
    console.log(spec);

    noteStore.findNotesMetadata(filter, 0, 10, spec, function(err, notelist) {
        console.log("findNotesMetadata:")
        console.log(err);
        console.log(notelist);
        var notes = notelist.notes;
        for (var i=0; i<notes.length; ++i) {
            var n = notes[i];
            //console.log(n);
            noteStore.getNoteContent(n.guid, function(err, note) {
                console.log(err);
                console.log(note);
            });
        }
    });

});

