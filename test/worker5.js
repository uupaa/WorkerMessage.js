importScripts("../lib/WorkerMessage.js");

throw new Error("lol"); // [1]

var worker = new WorkerMessage("", function(event) {
        worker.post(event.data + " WORLD");
    }, function(ready, cancel) {
    });

