/*
onmessage = function(event) { // from worker.postMessage
    console.log(event.data); // "__INIT__"

    port = event.ports[0];
    port.onmessage = function(event) {
        console.log(event.data);

        port.postMessage(event.data + " response " + Date.now());
    };
};
 */

importScripts("../lib/WorkerMessage.js");

var worker = new WorkerMessage("", function(event) {
        var a = new Uint8Array(event.data.a);
        console.log("get request! " + a[0] + a[1] + a[2]);

        var b = new Uint8Array([1,2,3]);
        worker.post({ b: b.buffer }, [b.buffer]);
    });

