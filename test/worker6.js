importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(message, token, event) {

        worker.close(); // [1]
    }, function(ready, cancel) {
    });

