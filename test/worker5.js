importScripts("../lib/WorkerMessage.js");

throw new Error("lol"); // [1]

var worker = new WorkerMessage("", function(message, token, event) {
        worker.post(message + " WORLD");
    }, function(ready, cancel) {
    });

