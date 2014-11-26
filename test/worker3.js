importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(message, token, event) {
        worker.post(message + " WORLD");
    }, function(ready, cancel) {
      //ready();
      //cancel();
      // [2]
    });

