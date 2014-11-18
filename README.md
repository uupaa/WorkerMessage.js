# WorkerMessage.js [![Build Status](https://travis-ci.org/uupaa/WorkerMessage.js.png)](http://travis-ci.org/uupaa/WorkerMessage.js)

[![npm](https://nodei.co/npm/uupaa.workermessage.js.png?downloads=true&stars=true)](https://nodei.co/npm/uupaa.workermessage.js/)

WebWorkers + MessageChannel functions

## Document

- [WorkerMessage.js wiki](https://github.com/uupaa/WorkerMessage.js/wiki/WorkerMessage)
- [WebModule](https://github.com/uupaa/WebModule)
    - [Slide](http://uupaa.github.io/Slide/slide/WebModule/index.html)
    - [Development](https://github.com/uupaa/WebModule/wiki/Development)

## How to use

### Browser

```js
// worker.html

<script src="lib/WorkerMessage.js"></script>
<script>

var worker = new WorkerMessage("worker.js", function(event) {

        console.log(event.data); // "HELLO WORLD"
        worker.close();

    }, function(exitCode, errorMessage) {

        switch (exitCode) {
        case WorkerMessage.EXIT_CODE.OK: // 0
            console.log("Safely closed.");
            break;
        case WorkerMessage.EXIT_CODE.ERROR: // 1
            console.log("Terminates with an error from WorkerThread. " + errorMessage);
            break;
        case WorkerMessage.EXIT_CODE.FORCE: // 2
            console.log("Forced termination by user.");
            break;
        case WorkerMessage.EXIT_CODE.TIMEOUT: // 3
            console.log("Watchdog barked.");
            break;
        }
    });

worker.post("HELLO");

</script>
```

### WebWorkers

```js
// worker.js

importScripts("lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {

        worker.post(event.data + " WORLD");

    }, function(ready, cancel) {
        // .... destruction process...

        ready();  // -> WORKER_CLOSE_READY
      //cancel(); // -> WORKER_CLOSE_CANCEL
    });

```

