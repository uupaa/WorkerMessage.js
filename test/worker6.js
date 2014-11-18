importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {

        worker.close(); // [1]
    }, function(ready, cancel) {
    });

