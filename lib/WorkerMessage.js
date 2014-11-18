(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

var EXIT_CODE = {
        "OK":       0,  // Safely closed.
        "ERROR":    1,  // Terminates with an error from WorkerThread.
        "FORCE":    2,  // Forced termination by user.
        "TIMEOUT":  3   // Watchdog barked.
    };

// --- class / interfaces ----------------------------------
function WorkerMessage(workerScript,  // @arg URLString = "" - new Workers(workerScript)
                       handleMessage, // @arg Function - handleMessage(message:Any):void
                       handleClose) { // @arg Function - handleClose(exitCode:Integer, errorMessage:String):void in MainThread
                                      //              or handleClose(ready:Function, cancel:Function):void in WorkerThread
//{@dev
    $valid($type(workerScript,  "URLString|omit"), WorkerMessage, "workerScript");
    $valid($type(handleMessage, "Function"),       WorkerMessage, "handleMessage");
    $valid($type(handleClose,   "Function"),       WorkerMessage, "handleClose");
//}@dev
    var that = this;

    if (_runOnBrowser) {
        this._handleClose = handleClose;
        this._watchdogTimer = 0;
        this._messageChannel = new MessageChannel();
        this._controlChannel = new MessageChannel();
        this._messageChannel["port1"]["onmessage"] = handleMessage; // handleMessage(event)
        this._controlChannel["port1"]["onmessage"] = function(event) {
            if (event.data === "WORKER_CLOSE_READY" || // [3] WorkerMessage#close() in MainThread
                event.data === "CLOSED") {             // [6] WorkerMessage#close() in WorkerThread
                _close(that, EXIT_CODE["OK"]);
            } else if (event.data === "WORKER_CLOSE_CANCEL") { // [4]
                _clearWatchdogTimer(that);
            }
        };
        this._worker = new Worker(workerScript);
        this._worker["onerror"] = function(error) {
            _close(that, EXIT_CODE["ERROR"], error.message);
        };
        this._worker["postMessage"]("init", [this._messageChannel["port2"],
                                             this._controlChannel["port2"]]);
    } else if (_runOnWorker) {
        global["onmessage"] = function(event) { // @arg Event - event.data === "init"
            if (event.data === "init") {
                global["MESSAGE_PORT2"] = event["ports"][0]; // messageChannel.port2
                global["CONTROL_PORT2"] = event["ports"][1]; // controlChannel.port2
                global["MESSAGE_PORT2"]["onmessage"] = handleMessage; // handleMessage(event)
                global["CONTROL_PORT2"]["onmessage"] = function(event) {

                    // When stopped too long time in this scope, watchdog will trigger.
                    // 長時間停止させているとwatchdogによりWorkerが殺されます

                    if (event.data === "CLOSE") {
                        handleClose(function() { // ready
                            global["CONTROL_PORT2"]["postMessage"]("WORKER_CLOSE_READY");  // [3]
                        }, function() { // cancel
                            global["CONTROL_PORT2"]["postMessage"]("WORKER_CLOSE_CANCEL"); // [4]
                        });
                    }
                };
            }
        };
    }
}

//{@dev
WorkerMessage["repository"] = "https://github.com/uupaa/WorkerMessage.js";
//}@dev

WorkerMessage["prototype"]["post"]    = WorkerMessage_post;    // WorkerMessage#post(requestMessage:Any, transfer:TransferableObjects):void
WorkerMessage["prototype"]["close"]   = WorkerMessage_close;   // WorkerMessage#close(delay:Integer = 10000):void
WorkerMessage["prototype"]["isAlive"] = WorkerMessage_isAlive; // WorkerMessage#isAlive():Boolean
WorkerMessage["EXIT_CODE"] = EXIT_CODE;

// --- implements ------------------------------------------
function WorkerMessage_post(requestMessage, // @arg Any
                            transfer) {     // @arg TransferableObjects - ArrayBuffer|File|Blob|FileList|CanvaProxy|undefined
    // Blink has the bug - https://code.google.com/p/chromium/issues/detail?id=334408
    // Issue 334408: ArrayBuffer is lost in MessageChannel during postMessage (receiver's event.data == null)
    var allowTransferableObjects = false;

    var port = _runOnWorker ? global["MESSAGE_PORT2"] : this._messageChannel["port1"];

    if (transfer && allowTransferableObjects) {
        port["postMessage"](requestMessage, transfer);
    } else {
        port["postMessage"](requestMessage);
    }
}

function WorkerMessage_close(delay) { // @arg Integer = 10000 - watch dog timer, -1 is force close.
    var that = this;

    if (_runOnBrowser) {
        //  - [1] set watch dog timer
        //  - [2] send a "CLOSE" message to WorkerThread
        //      - [3] response a "WORKER_CLOSE_READY" message from WorkerThread
        //          - stop watch dog timer
        //          - clear MessageChannel
        //          - close worker
        //      - [4] response a "WORKER_CLOSE_CANCEL" message from WorkerThread
        //          - stop watch dog timer
        //      - [5] ... no response... what's happen? -> fire watch dog timer
        //          - stop watch dog time
        //          - close MessageChannel
        //          - close worker
        if (delay === -1) { // force close
            _close(that, EXIT_CODE["FORCE"]);
        } else if (!that._watchdogTimer) {
            that._watchdogTimer = setTimeout(function() { // [1]
                _close(that, EXIT_CODE["TIMEOUT"]);
            }, delay || 10000);
            that._controlChannel["port1"]["postMessage"]("CLOSE"); // [2]
        }
    } else if (_runOnWorker) {
        // - [6] send a "CLOSED" message to MainThread
        global["CONTROL_PORT2"]["postMessage"]("CLOSED");
        global["close"](); // terminates the worker
    }
}

function WorkerMessage_isAlive() { // @ret Boolean
    return !!this._worker;
}

function _close(that, exitCode, errorMessage) {
    // [5]
    _clearWatchdogTimer(that);
    _closeMessageChannel(that);
    _closeWorker(that);
    that._handleClose(exitCode, errorMessage || "");
    that._handleClose = null;
}
function _clearWatchdogTimer(that) {
    if (that._watchdogTimer) {
        clearTimeout(that._watchdogTimer);
        that._watchdogTimer = 0;
    }
}
function _closeMessageChannel(that) {
    that._messageChannel["port1"]["close"]();
    that._messageChannel["port2"]["close"]();
    that._controlChannel["port1"]["close"]();
    that._controlChannel["port2"]["close"]();
    that._messageChannel = null;
    that._controlChannel = null;
}
function _closeWorker(that) {
    that._worker["terminate"]();
    that._worker = null;
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

