(function(global) {
"use strict";

// --- dependency modules ----------------------------------
// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

var EXIT_CODE_OK      = 0; // Safely closed.
var EXIT_CODE_ERROR   = 1; // Error in worker thread.
var EXIT_CODE_FORCE   = 2; // Forced termination by user.
var EXIT_CODE_TIMEOUT = 3; // Watchdog barked.

// --- class / interfaces ----------------------------------
function WorkerMessage(workerScript,  // @arg URLString = "" - new Workers(workerScript)
                       handleMessage, // @arg Function - handleMessage(message:Any, token:Integer, event:Event):void
                       handleClose) { // @arg Function - handleClose(exitCode:Integer, errorMessage:String):void in MainThread
                                      //              or handleClose(ready:Function, cancel:Function):void in WorkerThread
//{@dev
    $valid($type(workerScript,  "URLString|omit"), WorkerMessage, "workerScript");
    if (_runOnBrowser) {
        $valid($type(handleMessage, "Function|omit"), WorkerMessage, "handleMessage");
        $valid($type(handleClose,   "Function|omit"), WorkerMessage, "handleClose");
    } else if (_runOnWorker) {
        $valid($type(handleMessage, "Function"), WorkerMessage, "handleMessage");
        $valid($type(handleClose,   "Function"), WorkerMessage, "handleClose");
    }
//}@dev
    var that = this;

    if (_runOnBrowser) {
        this._postback = {}; // { token: postback, ... }
        this._handleClose = handleClose;
        this._tokenCounter = 0;
        this._watchdogTimer = 0;

        // One side messaging.
        //      thread(port2) --o--> main(port1)
        //      main(port1)   --x--> thread(port2)
        this._messageChannel = new MessageChannel();
        this._messageChannel["port1"]["onmessage"] = function(event) {
            if (event.data === "WORKER_CLOSE_READY" || // [3] WorkerMessage#close() in MainThread
                event.data === "CLOSED") {             // [6] WorkerMessage#close() in WorkerThread
                _close(that, EXIT_CODE_OK);
            } else if (event.data === "WORKER_CLOSE_CANCEL") { // [4]
                _clearWatchdogTimer(that);
            } else {
                var token = event.data["token"] || "";
                if (token) {
                    that._postback[token](event.data["msg"], token, event);
                    that._postback[token] = null;
                } else {
                    if (handleMessage) {
                        handleMessage(event.data["msg"], "", event);
                    }
                }
            }
        };
        this._worker = new Worker(workerScript);
        this._worker["onerror"] = function(error) {
            _close(that, EXIT_CODE_ERROR, error.message);
        };
        this._worker["postMessage"]("INIT", [this._messageChannel["port2"]]);
    } else if (_runOnWorker) {
        global["onmessage"] = function(event) { // event.data = COMMAND or { token, msg }
            if (event.data === "INIT") {
                global["MESSAGE_PORT2"] = event["ports"][0]; // messageChannel.port2
            } else if (event.data === "CLOSE") {
                // When stopped too long time in this scope, watchdog will trigger.
                // 長時間停止させているとwatchdogによりWorkerが殺されます
                if (handleClose) {
                    handleClose(function() { // ready
                        global["MESSAGE_PORT2"]["postMessage"]("WORKER_CLOSE_READY");  // [3]
                    }, function() { // cancel
                        global["MESSAGE_PORT2"]["postMessage"]("WORKER_CLOSE_CANCEL"); // [4]
                    });
                }
            } else {
                if (handleMessage) {
                    handleMessage(event.data["msg"], event.data["token"], event);
                }
            }
        };
    }
}

//{@dev
WorkerMessage["repository"] = "https://github.com/uupaa/WorkerMessage.js";
//}@dev

WorkerMessage["prototype"]["post"]    = WorkerMessage_post;    // WorkerMessage#post(message:Any, transfer:TransferableObjectArray = null, token:Integer = 0, postback:Function = null):void
WorkerMessage["prototype"]["close"]   = WorkerMessage_close;   // WorkerMessage#close(timeout:Integer = 10000):void

if (_runOnBrowser) {
    WorkerMessage["prototype"]["isAlive"]  = WorkerMessage_isAlive;  // WorkerMessage#isAlive():Boolean
    WorkerMessage["prototype"]["newToken"] = WorkerMessage_newToken; // WorkerMessage#newToken():Integer
    WorkerMessage["EXIT_CODE_OK"]      = EXIT_CODE_OK;
    WorkerMessage["EXIT_CODE_ERROR"]   = EXIT_CODE_ERROR;
    WorkerMessage["EXIT_CODE_FORCE"]   = EXIT_CODE_FORCE;
    WorkerMessage["EXIT_CODE_TIMEOUT"] = EXIT_CODE_TIMEOUT;
}

// Blink has the bug - https://code.google.com/p/chromium/issues/detail?id=334408
// Issue 334408: ArrayBuffer is lost in MessageChannel during postMessage (receiver's event.data == null)
WorkerMessage["ALLOW_TRANSFERABLE_OBJECT"] = false;

// --- implements ------------------------------------------
function WorkerMessage_post(message,    // @arg Any
                            transfer,   // @arg TransferableObjectArray = null - Literal|Array|Object|Set|Map|ArrayBuffer|TypedArray|File|Blob|FileList|CanvasProxy...
                            token,      // @arg Integer = 0 - postback token
                            postback) { // @arg Function = null - postback(event)
//{@dev
    $valid($type(message,  "Any"),          WorkerMessage, "message");
    $valid($type(transfer, "Any|omit"),     WorkerMessage, "transfer");
    $valid($type(token,    "Integer|omit"), WorkerMessage, "token");
    $valid($type(postback, "Function|omit"),WorkerMessage, "postback");
//}@dev

    var port  = _runOnWorker  ? global["MESSAGE_PORT2"] : this._worker;
    var allow = _runOnBrowser ? true : WorkerMessage["ALLOW_TRANSFERABLE_OBJECT"];

    if (_runOnBrowser) {
        if (postback) {
            token = token || this["newToken"]();
            this._postback[token] = postback; // register postback
        }
    }
    if (transfer && allow) {
        // http://www.w3.org/html/wg/drafts/html/master/infrastructure.html#transferable-objects
//{@dev
        $valid($type(transfer, "Array"), WorkerMessage, "transfer");
        for (var i = 0, iz = transfer.length; i < iz; ++i) {
            $valid($type(transfer[i], "ArrayBuffer|CanvasProxy|MessagePort"), WorkerMessage, "transfer");
        }
//}@dev
        port["postMessage"]({ "token": token || 0, "msg": message }, transfer);
    } else {
        port["postMessage"]({ "token": token || 0, "msg": message });
    }
}

function WorkerMessage_close(timeout) { // @arg Integer = 10000 - watch dog timer, -1 is force close.
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
        if (timeout === -1) { // force close
            _close(that, EXIT_CODE_FORCE);
        } else if (!that._watchdogTimer) {
            that._watchdogTimer = setTimeout(function() { // [1]
                _close(that, EXIT_CODE_TIMEOUT);
            }, timeout || 10000);
            that._worker["postMessage"]("CLOSE"); // [2]
        }
    } else if (_runOnWorker) {
        // - [6] send a "closed" message to MainThread
        global["MESSAGE_PORT2"]["postMessage"]("CLOSED");
        global["close"](); // terminates the worker
    }
}

function WorkerMessage_isAlive() { // @ret Boolean
    return !!this._worker;
}
function WorkerMessage_newToken() { // @ret Integer
    return ++this._tokenCounter;
}
function _close(that, exitCode, errorMessage) {
    // [5]
    _clearWatchdogTimer(that);
    _closeMessageChannel(that);
    _closeWorker(that);
    if (that._handleClose) {
        that._handleClose(exitCode, errorMessage || "");
        that._handleClose = null;
    }
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
    that._messageChannel = null;
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

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = WorkerMessage;
}
global["WorkerMessage" in global ? "WorkerMessage_" : "WorkerMessage"] = WorkerMessage; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

