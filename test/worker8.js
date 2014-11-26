importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(message, token, event) {
        worker.post(message + " WORLD", null, token); // [2]
    }, function(ready, cancel) {
        ready(); // [5]
    });

