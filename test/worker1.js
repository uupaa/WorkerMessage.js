importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(message, token, event) {
        worker.post(message + " WORLD"); // [2]
    }, function(ready, cancel) {
        ready(); // [5]
    });

