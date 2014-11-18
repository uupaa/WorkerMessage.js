importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {
        worker.post(event.data + " WORLD"); // [2]
    }, function(ready, cancel) {
        ready(); // [5]
    });

