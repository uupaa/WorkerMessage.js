importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {
        worker.post(event.data + " WORLD");
    }, function(ready, cancel) {
        throw new Error("lol"); // [1]
    });

