(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
//var _runOnBrowser = "document" in global;

// --- class / interfaces ----------------------------------
function WorkerMessage(workerScript,    // @arg URLString = "" - new Workers(workerScript)
                       callback,        // @arg Function = null - callback(responseMessage:Any):void
                       errorCallback) { // @arg Function = null - errorCallback(err:Error):void
//{@dev
    $valid($type(workerScript,  "URLString|omit"), WorkerMessage, "workerScript");
    $valid($type(callback,      "Function|null"),  WorkerMessage, "callback");
    $valid($type(errorCallback, "Function|null"),  WorkerMessage, "errorCallback");
//}@dev

    if (_runOnWorker) {
        global["onmessage"] = function(event) {
            if (event.data === "__INIT__") {
                global["port2"] = event["ports"][0];
                global["port2"]["onmessage"] = function(event) {
                    if (callback) {
                        callback(event);
                    }
                };
            }
        };
    } else {
        this._channel = new MessageChannel();
        this._channel["port1"]["onmessage"] = function(event) {
            if (callback) {
                callback(event);
            }
        };
        this._worker = new Worker(workerScript);
        this._worker["onmessage"] = function(event) {
            if (event.type === "error") {
                if (errorCallback) {
                    errorCallback(new Error(event.message));
                }
            }
        };
        this._worker["postMessage"]("__INIT__", [this._channel["port2"]]);
    }
}

//{@dev
WorkerMessage["repository"] = "https://github.com/uupaa/WorkerMessage.js";
//}@dev

WorkerMessage["prototype"]["post"]  = WorkerMessage_post;
WorkerMessage["prototype"]["start"] = WorkerMessage_start;
WorkerMessage["prototype"]["close"] = WorkerMessage_close;

// --- implements ------------------------------------------
function WorkerMessage_post(requestMessage, // @arg Any
                            transfer) {     // @arg ArrayBuffer|undefined
    var port = _runOnWorker ? global["port2"] : this._channel["port1"];

    if (0) {
        // Blink has the bug - https://code.google.com/p/chromium/issues/detail?id=334408
        // Issue 334408: ArrayBuffer is lost in MessageChannel during postMessage (receiver's event.data == null)
        if (transfer) {
            port["postMessage"](requestMessage, transfer);
        } else {
            port["postMessage"](requestMessage);
        }
    } else {
        port["postMessage"](requestMessage);
    }
}
function WorkerMessage_start() {
    var port = _runOnWorker ? global["port2"] : this._channel["port1"];

    port["start"]();
}
function WorkerMessage_close() {
    var port = _runOnWorker ? global["port2"] : this._channel["port1"];

    port["close"]();
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- initialize ------------------------------------------

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WorkerMessage;
}
global["WorkerMessage" in global ? "WorkerMessage_" : "WorkerMessage"] = WorkerMessage; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule


