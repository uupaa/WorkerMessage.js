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
        var b = new Uint8Array(event.data.b);
        console.log("get response! " + b[0] + b[1] + b[2]);
    }, function(err) { });

setTimeout(function() {
    var a = new Uint8Array([9,8,7]);
    worker.post({ a: a.buffer }, [a.buffer]);
    //                           ~~~~~~~~~~
    //                           transferable-objects
}, 2000);

</script>
```

### WebWorkers

```js
// worker.js

importScripts("lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {
        var a = new Uint8Array(event.data.a);
        console.log("get request! " + a[0] + a[1] + a[2]);

        var b = new Uint8Array([1,2,3]);
        worker.post({ b: b.buffer }, [b.buffer]);
        //                           ~~~~~~~~~~
        //                           transferable-objects
    });
``

