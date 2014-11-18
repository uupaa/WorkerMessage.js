importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {
        worker.post(event.data + " WORLD");
    }, function(ready, cancel) {
      //ready();
        cancel(); // [2]
    });

