(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.angularDragula = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var dragulaService = require('./service');
var dragulaDirective = require('./directive');

function register (angular) {
  var app = angular.module('dragula', ['ng']);

  app.factory('dragulaService', dragulaService(angular));
  app.directive('dragula', dragulaDirective(angular));

  return 'dragula';
}

module.exports = register;

},{"./directive":2,"./service":14}],2:[function(require,module,exports){
'use strict';

var dragula = require('dragula');

/*jshint unused: false*/
function register (angular) {
  return ['dragulaService', function angularDragula (dragulaService) {
    return {
      restrict: 'A',
      scope: {
        dragulaScope: '=',
        dragulaModel: '='
      },
      link: link
    };

    function link (scope, elem, attrs) {
      var dragulaScope = scope.dragulaScope || scope.$parent;
      var container = elem[0];
      var name = scope.$eval(attrs.dragula);
      var drake;

      var bag = dragulaService.find(dragulaScope, name);
      if (bag) {
        drake = bag.drake;
        drake.containers.push(container);
      } else {
        drake = dragula({
          containers: [container]
        });
        dragulaService.add(dragulaScope, name, drake);
      }

			scope.$on('$destroy', function() {
				dragulaService.destroy(dragulaScope, name);
			});

      scope.$watch('dragulaModel', function (newValue, oldValue) {
        if (!newValue) {
          return;
        }

        if (drake.models) {
          var modelIndex = oldValue ? drake.models.indexOf(oldValue) : -1;
          if (modelIndex >= 0) {
            drake.models.splice(modelIndex, 1, newValue);
          } else {
            drake.models.push(newValue);
          }
        } else {
          drake.models = [newValue];
        }

        dragulaService.handleModels(dragulaScope, drake);
      });
    }
  }];
}

module.exports = register;

},{"dragula":9}],3:[function(require,module,exports){
module.exports = function atoa (a, n) { return Array.prototype.slice.call(a, n); }

},{}],4:[function(require,module,exports){
'use strict';

var ticky = require('ticky');

module.exports = function debounce (fn, args, ctx) {
  if (!fn) { return; }
  ticky(function run () {
    fn.apply(ctx || null, args || []);
  });
};

},{"ticky":12}],5:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var debounce = require('./debounce');

module.exports = function emitter (thing, options) {
  var opts = options || {};
  var evt = {};
  if (thing === undefined) { thing = {}; }
  thing.on = function (type, fn) {
    if (!evt[type]) {
      evt[type] = [fn];
    } else {
      evt[type].push(fn);
    }
    return thing;
  };
  thing.once = function (type, fn) {
    fn._once = true; // thing.off(fn) still works!
    thing.on(type, fn);
    return thing;
  };
  thing.off = function (type, fn) {
    var c = arguments.length;
    if (c === 1) {
      delete evt[type];
    } else if (c === 0) {
      evt = {};
    } else {
      var et = evt[type];
      if (!et) { return thing; }
      et.splice(et.indexOf(fn), 1);
    }
    return thing;
  };
  thing.emit = function () {
    var args = atoa(arguments);
    return thing.emitterSnapshot(args.shift()).apply(this, args);
  };
  thing.emitterSnapshot = function (type) {
    var et = (evt[type] || []).slice(0);
    return function () {
      var args = atoa(arguments);
      var ctx = this || thing;
      if (type === 'error' && opts.throws !== false && !et.length) { throw args.length === 1 ? args[0] : args; }
      et.forEach(function emitter (listen) {
        if (opts.async) { debounce(listen, args, ctx); } else { listen.apply(ctx, args); }
        if (listen._once) { thing.off(type, listen); }
      });
      return thing;
    };
  };
  return thing;
};

},{"./debounce":4,"atoa":3}],6:[function(require,module,exports){
(function (global){
'use strict';

var customEvent = require('custom-event');
var eventmap = require('./eventmap');
var doc = global.document;
var addEvent = addEventEasy;
var removeEvent = removeEventEasy;
var hardCache = [];

if (!global.addEventListener) {
  addEvent = addEventHard;
  removeEvent = removeEventHard;
}

module.exports = {
  add: addEvent,
  remove: removeEvent,
  fabricate: fabricateEvent
};

function addEventEasy (el, type, fn, capturing) {
  return el.addEventListener(type, fn, capturing);
}

function addEventHard (el, type, fn) {
  return el.attachEvent('on' + type, wrap(el, type, fn));
}

function removeEventEasy (el, type, fn, capturing) {
  return el.removeEventListener(type, fn, capturing);
}

function removeEventHard (el, type, fn) {
  var listener = unwrap(el, type, fn);
  if (listener) {
    return el.detachEvent('on' + type, listener);
  }
}

function fabricateEvent (el, type, model) {
  var e = eventmap.indexOf(type) === -1 ? makeCustomEvent() : makeClassicEvent();
  if (el.dispatchEvent) {
    el.dispatchEvent(e);
  } else {
    el.fireEvent('on' + type, e);
  }
  function makeClassicEvent () {
    var e;
    if (doc.createEvent) {
      e = doc.createEvent('Event');
      e.initEvent(type, true, true);
    } else if (doc.createEventObject) {
      e = doc.createEventObject();
    }
    return e;
  }
  function makeCustomEvent () {
    return new customEvent(type, { detail: model });
  }
}

function wrapperFactory (el, type, fn) {
  return function wrapper (originalEvent) {
    var e = originalEvent || global.event;
    e.target = e.target || e.srcElement;
    e.preventDefault = e.preventDefault || function preventDefault () { e.returnValue = false; };
    e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
    e.which = e.which || e.keyCode;
    fn.call(el, e);
  };
}

function wrap (el, type, fn) {
  var wrapper = unwrap(el, type, fn) || wrapperFactory(el, type, fn);
  hardCache.push({
    wrapper: wrapper,
    element: el,
    type: type,
    fn: fn
  });
  return wrapper;
}

function unwrap (el, type, fn) {
  var i = find(el, type, fn);
  if (i) {
    var wrapper = hardCache[i].wrapper;
    hardCache.splice(i, 1); // free up a tad of memory
    return wrapper;
  }
}

function find (el, type, fn) {
  var i, item;
  for (i = 0; i < hardCache.length; i++) {
    item = hardCache[i];
    if (item.element === el && item.type === type && item.fn === fn) {
      return i;
    }
  }
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./eventmap":7,"custom-event":8}],7:[function(require,module,exports){
(function (global){
'use strict';

var eventmap = [];
var eventname = '';
var ron = /^on/;

for (eventname in global) {
  if (ron.test(eventname)) {
    eventmap.push(eventname.slice(2));
  }
}

module.exports = eventmap;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],8:[function(require,module,exports){
(function (global){

var NativeCustomEvent = global.CustomEvent;

function useNative () {
  try {
    var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
    return  'cat' === p.type && 'bar' === p.detail.foo;
  } catch (e) {
  }
  return false;
}

/**
 * Cross-browser `CustomEvent` constructor.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
 *
 * @public
 */

module.exports = useNative() ? NativeCustomEvent :

// IE >= 9
'function' === typeof document.createEvent ? function CustomEvent (type, params) {
  var e = document.createEvent('CustomEvent');
  if (params) {
    e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
  } else {
    e.initCustomEvent(type, false, false, void 0);
  }
  return e;
} :

// IE <= 8
function CustomEvent (type, params) {
  var e = document.createEventObject();
  e.type = type;
  if (params) {
    e.bubbles = Boolean(params.bubbles);
    e.cancelable = Boolean(params.cancelable);
    e.detail = params.detail;
  } else {
    e.bubbles = false;
    e.cancelable = false;
    e.detail = void 0;
  }
  return e;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],9:[function(require,module,exports){
(function (global){
'use strict';

var emitter = require('contra/emitter');
var crossvent = require('crossvent');
var fastdom = require('fastdom');
var fastdomPromised = require('fastdom/extensions/fastdom-promised');

var fd = fastdom.extend(fastdomPromised);
var doc = document;
var documentElement = doc.documentElement;

function dragula(initialContainers, options) {
	var len = arguments.length;
	if (len === 1 && Array.isArray(initialContainers) === false) {
		options = initialContainers;
		initialContainers = [];
	}
	var _mirror; // mirror image
	var _source; // source container
	var _item; // item being dragged
	var _offsetX; // reference x
	var _offsetY; // reference y
	var _moveX; // reference move x
	var _moveY; // reference move y
	var _initialSibling; // reference sibling when grabbed
	var _currentSibling; // reference sibling now
	var _copy; // item used for copying
	var _renderTimer; // timer for setTimeout renderMirrorImage
	var _lastDropTarget = null; // last container item was over
	var _grabbed; // holds mousedown context until first mousemove

	var o = options || {};
	if (o.moves === void 0) {
		o.moves = always;
	}
	if (o.accepts === void 0) {
		o.accepts = always;
	}
	if (o.invalid === void 0) {
		o.invalid = invalidTarget;
	}
	if (o.containers === void 0) {
		o.containers = initialContainers || [];
	}
	if (o.isContainer === void 0) {
		o.isContainer = never;
	}
	if (o.copy === void 0) {
		o.copy = false;
	}
	if (o.copySortSource === void 0) {
		o.copySortSource = false;
	}
	if (o.revertOnSpill === void 0) {
		o.revertOnSpill = false;
	}
	if (o.removeOnSpill === void 0) {
		o.removeOnSpill = false;
	}
	if (o.direction === void 0) {
		o.direction = 'vertical';
	}
	if (o.ignoreInputTextSelection === void 0) {
		o.ignoreInputTextSelection = true;
	}
	if (o.mirrorContainer === void 0) {
		o.mirrorContainer = doc.body;
	}

	var drake = emitter({
		containers: o.containers,
		start: manualStart,
		end: end,
		cancel: cancel,
		remove: remove,
		destroy: destroy,
		canMove: canMove,
		dragging: false
	});

	if (o.removeOnSpill === true) {
		drake.on('over', spillOver).on('out', spillOut);
	}

	events();

	return drake;

	function isContainer(el) {
		return drake.containers.indexOf(el) !== -1 || o.isContainer(el);
	}

	function events(remove) {
		var op = remove ? 'remove' : 'add';
		touchy(documentElement, op, 'mousedown', grab);
		touchy(documentElement, op, 'mouseup', release);
	}

	function eventualMovements(remove) {
		var op = remove ? 'remove' : 'add';
		touchy(documentElement, op, 'mousemove', startBecauseMouseMoved);
	}

	function movements(remove) {
		var op = remove ? 'remove' : 'add';
		crossvent[op](documentElement, 'selectstart', preventGrabbed); // IE8
		crossvent[op](documentElement, 'click', preventGrabbed);
	}

	function destroy() {
		events(true);
		release({});
	}

	function preventGrabbed(e) {
		if (_grabbed) {
			e.preventDefault();
		}
	}

	function grab(e) {
		_moveX = e.clientX;
		_moveY = e.clientY;

		var ignore = whichMouseButton(e) !== 1 || e.metaKey || e.ctrlKey;
		if (ignore) {
			return; // we only care about honest-to-god left clicks and touch events
		}
		var item = e.target;
		var context = canStart(item);
		if (!context) {
			return;
		}
		_grabbed = context;
		eventualMovements();
		if (e.type === 'mousedown') {
			if (isInput(item)) { // see also: https://github.com/bevacqua/dragula/issues/208
				item.focus(); // fixes https://github.com/bevacqua/dragula/issues/176
			} else {
				e.preventDefault(); // fixes https://github.com/bevacqua/dragula/issues/155
			}
		}
	}

	function startBecauseMouseMoved(e) {
		if (!_grabbed) {
			return;
		}
		if (whichMouseButton(e) === 0) {
			release({});
			return; // when text is selected on an input and then dragged, mouseup doesn't fire. this is our only hope
		}
		// truthy check fixes #239, equality fixes #207
		if (e.clientX !== void 0 && e.clientX === _moveX && e.clientY !== void 0 && e.clientY === _moveY) {
			return;
		}
		if (o.ignoreInputTextSelection) {
			var clientX = getCoord('clientX', e);
			var clientY = getCoord('clientY', e);
			var elementBehindCursor = doc.elementFromPoint(clientX, clientY);
			if (isInput(elementBehindCursor)) {
				return;
			}
		}

		var grabbed = _grabbed; // call to end() unsets _grabbed
		eventualMovements(true);
		movements();
		end();
		start(grabbed);

		var offset = getOffset(_item);
		_offsetX = getCoord('pageX', e) - offset.left;
		_offsetY = getCoord('pageY', e) - offset.top;

		(_copy || _item).classList.add('gu-transit');

		renderMirrorImage().then(function() {
			drag(e);
		});
	}

	function canStart(item) {
		if (drake.dragging && _mirror) {
			return;
		}
		if (isContainer(item)) {
			return; // don't drag container itself
		}
		var handle = item;
		while (getParent(item) && isContainer(getParent(item)) === false) {
			if (o.invalid(item, handle)) {
				return;
			}
			item = getParent(item); // drag target should be a top element
			if (!item) {
				return;
			}
		}
		var source = getParent(item);
		if (!source) {
			return;
		}
		if (o.invalid(item, handle)) {
			return;
		}

		var movable = o.moves(item, source, handle, nextEl(item));
		if (!movable) {
			return;
		}

		return {
			item: item,
			source: source
		};
	}

	function canMove(item) {
		return !!canStart(item);
	}

	function manualStart(item) {
		var context = canStart(item);
		if (context) {
			start(context);
		}
	}

	function start(context) {
		if (isCopy(context.item, context.source)) {
			_copy = context.item.cloneNode(true);
			drake.emit('cloned', _copy, context.item, 'copy');
		}

		_source = context.source;
		_item = context.item;
		_initialSibling = _currentSibling = nextEl(context.item);

		drake.dragging = true;
		drake.emit('drag', _item, _source);
	}

	function invalidTarget() {
		return false;
	}

	function end() {
		if (!drake.dragging) {
			return;
		}
		var item = _copy || _item;
		drop(item, getParent(item));
	}

	function ungrab() {
		_grabbed = false;
		eventualMovements(true);
		movements(true);
	}

	function release(e) {
		ungrab();

		if (!drake.dragging) {
			return;
		}

		var item = _copy || _item;
		var clientX = getCoord('clientX', e);
		var clientY = getCoord('clientY', e);
		var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
		var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);
		if (dropTarget && ((_copy && o.copySortSource) || (!_copy || dropTarget !== _source))) {
			drop(item, dropTarget);
		} else if (o.removeOnSpill) {
			remove();
		} else {
			cancel();
		}

		e.preventDefault();
		e.stopPropagation();
	}

	function drop(item, target) {
		var parent = getParent(item);
		if (_copy && o.copySortSource && target === _source) {
			parent.removeChild(_item);
		}
		if (isInitialPlacement(target)) {
			drake.emit('cancel', item, _source, _source);
		} else {
			drake.emit('drop', item, target, _source, _currentSibling);
		}
		cleanup();
	}

	function remove() {
		if (!drake.dragging) {
			return;
		}
		var item = _copy || _item;
		var parent = getParent(item);
		if (parent) {
			parent.removeChild(item);
		}
		drake.emit(_copy ? 'cancel' : 'remove', item, parent, _source);
		cleanup();
	}

	function cancel(revert) {
		if (!drake.dragging) {
			return;
		}
		var reverts = arguments.length > 0 ? revert : o.revertOnSpill;
		var item = _copy || _item;
		var parent = getParent(item);
		var initial = isInitialPlacement(parent);
		if (initial === false && reverts) {
			if (_copy) {
				parent.removeChild(_copy);
			} else {
				_source.insertBefore(item, _initialSibling);
			}
		}
		if (initial || reverts) {
			drake.emit('cancel', item, _source, _source);
		} else {
			drake.emit('drop', item, parent, _source, _currentSibling);
		}
		cleanup();
	}

	function cleanup() {
		var item = _copy || _item;
		ungrab();
		removeMirrorImage();
		if (item) {
			item.classList.remove('gu-transit');
		}
		if (_renderTimer) {
			clearTimeout(_renderTimer);
		}
		drake.dragging = false;
		if (_lastDropTarget) {
			drake.emit('out', item, _lastDropTarget, _source);
		}
		drake.emit('dragend', item);
		_source = _item = _copy = _initialSibling = _currentSibling = _renderTimer = _lastDropTarget = null;
	}

	function isInitialPlacement(target, s) {
		var sibling;
		if (s !== void 0) {
			sibling = s;
		} else if (_mirror) {
			sibling = _currentSibling;
		} else {
			sibling = nextEl(_copy || _item);
		}
		return target === _source && sibling === _initialSibling;
	}

	function findDropTarget(elementBehindCursor, clientX, clientY) {
		var target = elementBehindCursor;
		while (target && !accepted()) {
			target = getParent(target);
		}
		return target;

		function accepted() {
			var droppable = isContainer(target);
			if (droppable === false) {
				return false;
			}

			var immediate = getImmediateChild(target, elementBehindCursor);
			var reference = getReference(target, immediate, clientX, clientY);
			var initial = isInitialPlacement(target, reference);
			if (initial) {
				return true; // should always be able to drop it right back where it was
			}
			return o.accepts(_item, target, _source, reference);
		}
	}

	function drag(e) {
		if (!_mirror) {
			return;
		}
		e.preventDefault();

		var clientX = getCoord('clientX', e);
		var clientY = getCoord('clientY', e);
		var x = clientX - _offsetX;
		var y = clientY - _offsetY;

		var item = _copy || _item;
		var elementBehindCursor = getElementBehindPoint(_mirror, clientX, clientY);
		var dropTarget = findDropTarget(elementBehindCursor, clientX, clientY);

		positionShadow();
		moveMirror();

		function positionShadow() {
			var changed = dropTarget !== null && dropTarget !== _lastDropTarget;
			if (changed || dropTarget === null) {
				out();
				_lastDropTarget = dropTarget;
				over();
			}

			var parent = getParent(item);
			if (dropTarget === _source && _copy && !o.copySortSource) {
				if (parent) {
					parent.removeChild(item);
				}
				return;
			}

			var reference;
			var immediate = getImmediateChild(dropTarget, elementBehindCursor);
			if (immediate !== null) {
				reference = getReference(dropTarget, immediate, clientX, clientY);
			} else if (o.revertOnSpill === true && !_copy) {
				reference = _initialSibling;
				dropTarget = _source;
			} else {
				if (_copy && parent) {
					parent.removeChild(item);
				}
				return;
			}

			if (
				(reference === null && changed) ||
				reference !== item &&
				reference !== nextEl(item)
			) {
				_currentSibling = reference;

				dropTarget.insertBefore(item, reference);
				drake.emit('shadow', item, dropTarget, _source);
			}

			function over() {
				if (changed) {
					moved('over');
				}
			}

			function out() {
				if (_lastDropTarget) {
					moved('out');
				}
			}

			function moved(type) {
				drake.emit(type, item, _lastDropTarget, _source);
			}
		}

		function moveMirror() {
			fd.mutate(function() {
				var translateFunc = 'translate3d(' + x + 'px, ' + y + 'px, 0px) rotate(-3deg)';

				_mirror.style.transform = translateFunc;
				_mirror.style.webkitTransform = translateFunc;
				_mirror.style.msTransform = translateFunc;
				_mirror.style.MozTransform = translateFunc;
				_mirror.classList.remove('gu-hide');
			});
		}
	}

	function spillOver(el) {
		el.classList.remove('gu-hide');
	}

	function spillOut(el) {
		if (drake.dragging) {
			el.classList.add('gu-hide');
		}
	}

	function renderMirrorImage() {
		if (_mirror) {
			return;
		}

		_mirror = _item.cloneNode(true);

		var rect = _item.getBoundingClientRect();

		return fd.mutate(function () {
			o.mirrorContainer.classList.add('gu-unselectable');

			_mirror.style.width = rect.width + 'px';
			_mirror.style.height = rect.height + 'px';
			_mirror.style.top = 0;
			_mirror.style.left = 0;

			_mirror.classList.remove('gu-transit');
			_mirror.classList.add('gu-mirror');
			_mirror.classList.add('gu-hide');

			o.mirrorContainer.appendChild(_mirror);
		}).then(function () {
			touchy(documentElement, 'add', 'mousemove', drag);
			drake.emit('cloned', _mirror, _item, 'mirror');
		});
	}

	function removeMirrorImage() {
		if (_mirror) {
			o.mirrorContainer.classList.remove('gu-unselectable');
			touchy(documentElement, 'remove', 'mousemove', drag);
			getParent(_mirror).removeChild(_mirror);
			_mirror = null;
		}
	}

	function getImmediateChild(dropTarget, target) {
		var immediate = target;
		while (immediate !== dropTarget && getParent(immediate) !== dropTarget) {
			immediate = getParent(immediate);
		}
		if (immediate === documentElement) {
			return null;
		}
		return immediate;
	}

	function getReference(dropTarget, target, x, y) {
		var horizontal = o.direction === 'horizontal';
		var reference = target !== dropTarget ? inside() : outside();
		return reference;

		function outside() { // slower, but able to figure out any position
			var len = dropTarget.children.length;
			var i;
			var el;
			var rect;
			for (i = 0; i < len; i++) {
				el = dropTarget.children[i];
				rect = el.getBoundingClientRect();
				if (horizontal && (rect.left + rect.width / 2) > x) {
					return el;
				}
				if (!horizontal && (rect.top + rect.height / 2) > y) {
					return el;
				}
			}
			return null;
		}

		function inside() { // faster, but only available if dropped inside a child element
			var rect = target.getBoundingClientRect();
			if (horizontal) {
				return resolve(x > rect.left + getRectWidth(rect) / 2);
			}
			return resolve(y > rect.top + getRectHeight(rect) / 2);
		}

		function resolve(after) {
			return after ? nextEl(target) : target;
		}
	}

	function isCopy(item, container) {
		return typeof o.copy === 'boolean' ? o.copy : o.copy(item, container);
	}
}

function touchy(el, op, type, fn) {
	var touch = {
		mouseup: 'touchend',
		mousedown: 'touchstart',
		mousemove: 'touchmove'
	};
	var pointers = {
		mouseup: 'pointerup',
		mousedown: 'pointerdown',
		mousemove: 'pointermove'
	};
	var microsoft = {
		mouseup: 'MSPointerUp',
		mousedown: 'MSPointerDown',
		mousemove: 'MSPointerMove'
	};
	if (global.navigator.pointerEnabled) {
		crossvent[op](el, pointers[type], fn);
	} else if (global.navigator.msPointerEnabled) {
		crossvent[op](el, microsoft[type], fn);
	} else {
		crossvent[op](el, touch[type], fn);
		crossvent[op](el, type, fn);
	}
}

function whichMouseButton(e) {
	if (e.touches !== void 0) {
		return e.touches.length;
	}
	if (e.which !== void 0 && e.which !== 0) {
		return e.which;
	} // see https://github.com/bevacqua/dragula/issues/261
	if (e.buttons !== void 0) {
		return e.buttons;
	}
	var button = e.button;
	if (button !== void 0) { // see https://github.com/jquery/jquery/blob/99e8ff1baa7ae341e94bb89c3e84570c7c3ad9ea/src/event.js#L573-L575
		return button & 1 ? 1 : button & 2 ? 3 : (button & 4 ? 2 : 0);
	}
}

function getOffset(el) {
	var rect = el.getBoundingClientRect();
	return {
		left: rect.left + getScroll('scrollLeft', 'pageXOffset'),
		top: rect.top + getScroll('scrollTop', 'pageYOffset')
	};
}

function getScroll(scrollProp, offsetProp) {
	if (typeof global[offsetProp] !== 'undefined') {
		return global[offsetProp];
	}
	if (documentElement.clientHeight) {
		return documentElement[scrollProp];
	}
	return doc.body[scrollProp];
}

function getElementBehindPoint(point, x, y) {
	/*
	var p = point || {};
	var state = p.className;
	var el;
	p.className += ' gu-hide';
	el = doc.elementFromPoint(x, y);
	p.className = state;
	return el;
	*/

	return doc.elementFromPoint(x, y);
}

function never() {
	return false;
}

function always() {
	return true;
}

function getRectWidth(rect) {
	return rect.width || (rect.right - rect.left);
}

function getRectHeight(rect) {
	return rect.height || (rect.bottom - rect.top);
}

function getParent(el) {
	return el.parentNode === doc ? null : el.parentNode;
}

function isInput(el) {
	return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || isEditable(el);
}

function isEditable(el) {
	if (!el) {
		return false;
	} // no parents were editable
	if (el.contentEditable === 'false') {
		return false;
	} // stop the lookup
	if (el.contentEditable === 'true') {
		return true;
	} // found a contentEditable element in the chain
	return isEditable(getParent(el)); // contentEditable is set to 'inherit'
}

function nextEl(el) {
	return el.nextElementSibling || manually();

	function manually() {
		var sibling = el;
		do {
			sibling = sibling.nextSibling;
		} while (sibling && sibling.nodeType !== 1);
		return sibling;
	}
}

function getEventHost(e) {
	// on touchend event, we have to use `e.changedTouches`
	// see http://stackoverflow.com/questions/7192563/touchend-event-properties
	// see https://github.com/bevacqua/dragula/issues/34
	if (e.targetTouches && e.targetTouches.length) {
		return e.targetTouches[0];
	}
	if (e.changedTouches && e.changedTouches.length) {
		return e.changedTouches[0];
	}
	return e;
}

function getCoord(coord, e) {
	var host = getEventHost(e);
	var missMap = {
		pageX: 'clientX', // IE8
		pageY: 'clientY' // IE8
	};
	if (coord in missMap && !(coord in host) && missMap[coord] in host) {
		coord = missMap[coord];
	}
	return host[coord];
}

module.exports = dragula;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"contra/emitter":5,"crossvent":6,"fastdom":11,"fastdom/extensions/fastdom-promised":10}],10:[function(require,module,exports){
!(function() {

/**
 * Wraps fastdom in a Promise API
 * for improved control-flow.
 *
 * @example
 *
 * // returning a result
 * fastdom.measure(() => el.clientWidth)
 *   .then(result => ...);
 *
 * // returning promises from tasks
 * fastdom.measure(() => {
 *   var w = el1.clientWidth;
 *   return fastdom.mutate(() => el2.style.width = w + 'px');
 * }).then(() => console.log('all done'));
 *
 * // clearing pending tasks
 * var promise = fastdom.measure(...)
 * fastdom.clear(promise);
 *
 * @type {Object}
 */
var exports = {
  initialize: function() {
    this._tasks = new Map();
  },

  mutate: function(fn, ctx) {
    return create(this, 'mutate', fn, ctx);
  },

  measure: function(fn, ctx) {
    return create(this, 'measure', fn, ctx);
  },

  clear: function(promise) {
    var tasks = this._tasks;
    var task = tasks.get(promise);
    this.fastdom.clear(task);
    tasks.delete(task);
  }
};

/**
 * Create a fastdom task wrapped in
 * a 'cancellable' Promise.
 *
 * @param  {FastDom}  fastdom
 * @param  {String}   type - 'measure'|'muatate'
 * @param  {Function} fn
 * @return {Promise}
 */
function create(promised, type, fn, ctx) {
  var tasks = promised._tasks;
  var fastdom = promised.fastdom;
  var task;

  var promise = new Promise(function(resolve, reject) {
    task = fastdom[type](function() {
      tasks.delete(promise);
      try { resolve(ctx ? fn.call(ctx) : fn()); }
      catch (e) { reject(e); }
    }, ctx);
  });

  tasks.set(promise, task);
  return promise;
}

// Expose to CJS, AMD or global
if ((typeof define)[0] == 'f') define(function() { return exports; });
else if ((typeof module)[0] == 'o') module.exports = exports;
else window.fastdomPromised = exports;

})();
},{}],11:[function(require,module,exports){
!(function(win) {

/**
 * FastDom
 *
 * Eliminates layout thrashing
 * by batching DOM read/write
 * interactions.
 *
 * @author Wilson Page <wilsonpage@me.com>
 * @author Kornel Lesinski <kornel.lesinski@ft.com>
 */

'use strict';

/**
 * Mini logger
 *
 * @return {Function}
 */
var debug = 0 ? console.log.bind(console, '[fastdom]') : function() {};

/**
 * Normalized rAF
 *
 * @type {Function}
 */
var raf = win.requestAnimationFrame
  || win.webkitRequestAnimationFrame
  || win.mozRequestAnimationFrame
  || win.msRequestAnimationFrame
  || function(cb) { return setTimeout(cb, 16); };

/**
 * Initialize a `FastDom`.
 *
 * @constructor
 */
function FastDom() {
  var self = this;
  self.reads = [];
  self.writes = [];
  self.raf = raf.bind(win); // test hook
  debug('initialized', self);
}

FastDom.prototype = {
  constructor: FastDom,

  /**
   * Adds a job to the read batch and
   * schedules a new frame if need be.
   *
   * @param  {Function} fn
   * @public
   */
  measure: function(fn, ctx) {
    debug('measure');
    var task = !ctx ? fn : fn.bind(ctx);
    this.reads.push(task);
    scheduleFlush(this);
    return task;
  },

  /**
   * Adds a job to the
   * write batch and schedules
   * a new frame if need be.
   *
   * @param  {Function} fn
   * @public
   */
  mutate: function(fn, ctx) {
    debug('mutate');
    var task = !ctx ? fn : fn.bind(ctx);
    this.writes.push(task);
    scheduleFlush(this);
    return task;
  },

  /**
   * Clears a scheduled 'read' or 'write' task.
   *
   * @param {Object} task
   * @return {Boolean} success
   * @public
   */
  clear: function(task) {
    debug('clear', task);
    return remove(this.reads, task) || remove(this.writes, task);
  },

  /**
   * Extend this FastDom with some
   * custom functionality.
   *
   * Because fastdom must *always* be a
   * singleton, we're actually extending
   * the fastdom instance. This means tasks
   * scheduled by an extension still enter
   * fastdom's global task queue.
   *
   * The 'super' instance can be accessed
   * from `this.fastdom`.
   *
   * @example
   *
   * var myFastdom = fastdom.extend({
   *   initialize: function() {
   *     // runs on creation
   *   },
   *
   *   // override a method
   *   measure: function(fn) {
   *     // do extra stuff ...
   *
   *     // then call the original
   *     return this.fastdom.measure(fn);
   *   },
   *
   *   ...
   * });
   *
   * @param  {Object} props  properties to mixin
   * @return {FastDom}
   */
  extend: function(props) {
    debug('extend', props);
    if (typeof props != 'object') throw new Error('expected object');

    var child = Object.create(this);
    mixin(child, props);
    child.fastdom = this;

    // run optional creation hook
    if (child.initialize) child.initialize();

    return child;
  },

  // override this with a function
  // to prevent Errors in console
  // when tasks throw
  catch: null
};

/**
 * Schedules a new read/write
 * batch if one isn't pending.
 *
 * @private
 */
function scheduleFlush(fastdom) {
  if (!fastdom.scheduled) {
    fastdom.scheduled = true;
    fastdom.raf(flush.bind(null, fastdom));
    debug('flush scheduled');
  }
}

/**
 * Runs queued `read` and `write` tasks.
 *
 * Errors are caught and thrown by default.
 * If a `.catch` function has been defined
 * it is called instead.
 *
 * @private
 */
function flush(fastdom) {
  debug('flush');

  var writes = fastdom.writes;
  var reads = fastdom.reads;
  var error;

  try {
    debug('flushing reads', reads.length);
    runTasks(reads);
    debug('flushing writes', writes.length);
    runTasks(writes);
  } catch (e) { error = e; }

  fastdom.scheduled = false;

  // If the batch errored we may still have tasks queued
  if (reads.length || writes.length) scheduleFlush(fastdom);

  if (error) {
    debug('task errored', error.message);
    if (fastdom.catch) fastdom.catch(error);
    else throw error;
  }
}

/**
 * We run this inside a try catch
 * so that if any jobs error, we
 * are able to recover and continue
 * to flush the batch until it's empty.
 *
 * @private
 */
function runTasks(tasks) {
  debug('run tasks');
  var task; while (task = tasks.shift()) task();
}

/**
 * Remove an item from an Array.
 *
 * @param  {Array} array
 * @param  {*} item
 * @return {Boolean}
 */
function remove(array, item) {
  var index = array.indexOf(item);
  return !!~index && !!array.splice(index, 1);
}

/**
 * Mixin own properties of source
 * object into the target.
 *
 * @param  {Object} target
 * @param  {Object} source
 */
function mixin(target, source) {
  for (var key in source) {
    if (source.hasOwnProperty(key)) target[key] = source[key];
  }
}

// There should never be more than
// one instance of `FastDom` in an app
var exports = win.fastdom = (win.fastdom || new FastDom()); // jshint ignore:line

// Expose to CJS & AMD
if ((typeof define)[0] == 'f') define(function() { return exports; });
else if ((typeof module)[0] == 'o') module.exports = exports;

})( typeof window !== 'undefined' ? window : this);

},{}],12:[function(require,module,exports){
var si = typeof setImmediate === 'function', tick;
if (si) {
  tick = function (fn) { setImmediate(fn); };
} else {
  tick = function (fn) { setTimeout(fn, 0); };
}

module.exports = tick;
},{}],13:[function(require,module,exports){
'use strict';

var atoa = require('atoa');
var events = [
  'cancel',
  'cloned',
  'drag',
  'dragend',
  'drop',
  'out',
  'over',
  'remove',
  'shadow',
  'drop-model',
  'remove-model'
];

function replicateEvents (angular, bag, scope) {
  events.forEach(replicator);

  function replicator (type) {
    bag.drake.on(type, replicate);

    function replicate () {
      var args = atoa(arguments).map(angularize);
      args.unshift(bag.name + '.' + type);
      scope.$emit.apply(scope, args);
    }
  }

  function angularize (value) {
    if (angular.isElement(value)) {
      return angular.element(value);
    }
    return value;
  }
}

module.exports = replicateEvents;

},{"atoa":3}],14:[function(require,module,exports){
'use strict';

var dragula = require('dragula');
var dragulaKey = '$$dragula';
var replicateEvents = require('./replicate-events');

function register (angular) {
  return [function dragulaService () {
    return {
      add: add,
      find: find,
      options: setOptions,
      destroy: destroy,
      handleModels: handleModels
    };
    function handleModels(scope, drake){
      if(drake.registered){ // do not register events twice
        return;
      }
      var dragElm;
      var dragIndex;
      var dropIndex;
      var sourceModel;
      drake.on('remove',function removeModel (el, source) {
        if (!drake.models) {
          return;
        }
        sourceModel = drake.models[drake.containers.indexOf(source)];
        scope.$applyAsync(function applyRemove() {
          sourceModel.splice(dragIndex, 1);
          drake.emit('remove-model', el, source);
        });
      });
      drake.on('drag',function dragModel (el, source) {
        dragElm = el;
        dragIndex = domIndexOf(el, source);
      });
      drake.on('drop',function dropModel (dropElm, target, source) {
        if (!drake.models) {
          return;
        }
        dropIndex = domIndexOf(dropElm, target);
        scope.$applyAsync(function applyDrop() {
          sourceModel = drake.models[drake.containers.indexOf(source)];
          if (target === source) {
            sourceModel.splice(dropIndex, 0, sourceModel.splice(dragIndex, 1)[0]);
          } else {
            var notCopy = dragElm === dropElm;
            var targetModel = drake.models[drake.containers.indexOf(target)];
            var dropElmModel = notCopy ? sourceModel[dragIndex] : angular.copy(sourceModel[dragIndex]);

            if (notCopy) {
              sourceModel.splice(dragIndex, 1);
            }
            targetModel.splice(dropIndex, 0, dropElmModel);
            target.removeChild(dropElm); // element must be removed for ngRepeat to apply correctly
          }
          drake.emit('drop-model', dropElm, target, source);
        });
      });
      drake.registered = true;
    }
    function getOrCreateCtx (scope) {
      var ctx = scope[dragulaKey];
      if (!ctx) {
        ctx = scope[dragulaKey] = {
          bags: []
        };
      }
      return ctx;
    }
    function domIndexOf(child, parent) {
      return Array.prototype.indexOf.call(angular.element(parent).children(), child);
    }
    function add (scope, name, drake) {
      var bag = find(scope, name);
      if (bag) {
        throw new Error('Bag named: "' + name + '" already exists in same angular scope.');
      }
      var ctx = getOrCreateCtx(scope);
      bag = {
        name: name,
        drake: drake
      };
      ctx.bags.push(bag);
      replicateEvents(angular, bag, scope);
      if(drake.models){ // models to sync with (must have same structure as containers)
        handleModels(scope, drake);
      }
      return bag;
    }
    function find (scope, name) {
      var bags = getOrCreateCtx(scope).bags;
      for (var i = 0; i < bags.length; i++) {
        if (bags[i].name === name) {
          return bags[i];
        }
      }
    }
    function destroy (scope, name) {
      var bags = getOrCreateCtx(scope).bags;
      var bag = find(scope, name);

			if (!bag) {
				return;
			}

      var i = bags.indexOf(bag);
      bags.splice(i, 1);
      bag.drake.destroy();
    }
    function setOptions (scope, name, options) {
      var bag = add(scope, name, dragula(options));
      handleModels(scope, bag.drake);
    }
  }];
}

module.exports = register;

},{"./replicate-events":13,"dragula":9}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhbmd1bGFyLWRyYWd1bGEuanMiLCJkaXJlY3RpdmUuanMiLCJub2RlX21vZHVsZXMvYXRvYS9hdG9hLmpzIiwibm9kZV9tb2R1bGVzL2NvbnRyYS9kZWJvdW5jZS5qcyIsIm5vZGVfbW9kdWxlcy9jb250cmEvZW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9kcmFndWxhL2RyYWd1bGEuanMiLCJub2RlX21vZHVsZXMvZmFzdGRvbS9leHRlbnNpb25zL2Zhc3Rkb20tcHJvbWlzZWQuanMiLCJub2RlX21vZHVsZXMvZmFzdGRvbS9mYXN0ZG9tLmpzIiwibm9kZV9tb2R1bGVzL3RpY2t5L3RpY2t5LWJyb3dzZXIuanMiLCJyZXBsaWNhdGUtZXZlbnRzLmpzIiwic2VydmljZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRyYWd1bGFTZXJ2aWNlID0gcmVxdWlyZSgnLi9zZXJ2aWNlJyk7XG52YXIgZHJhZ3VsYURpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vZGlyZWN0aXZlJyk7XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyIChhbmd1bGFyKSB7XG4gIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZHJhZ3VsYScsIFsnbmcnXSk7XG5cbiAgYXBwLmZhY3RvcnkoJ2RyYWd1bGFTZXJ2aWNlJywgZHJhZ3VsYVNlcnZpY2UoYW5ndWxhcikpO1xuICBhcHAuZGlyZWN0aXZlKCdkcmFndWxhJywgZHJhZ3VsYURpcmVjdGl2ZShhbmd1bGFyKSk7XG5cbiAgcmV0dXJuICdkcmFndWxhJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZWdpc3RlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRyYWd1bGEgPSByZXF1aXJlKCdkcmFndWxhJyk7XG5cbi8qanNoaW50IHVudXNlZDogZmFsc2UqL1xuZnVuY3Rpb24gcmVnaXN0ZXIgKGFuZ3VsYXIpIHtcbiAgcmV0dXJuIFsnZHJhZ3VsYVNlcnZpY2UnLCBmdW5jdGlvbiBhbmd1bGFyRHJhZ3VsYSAoZHJhZ3VsYVNlcnZpY2UpIHtcbiAgICByZXR1cm4ge1xuICAgICAgcmVzdHJpY3Q6ICdBJyxcbiAgICAgIHNjb3BlOiB7XG4gICAgICAgIGRyYWd1bGFTY29wZTogJz0nLFxuICAgICAgICBkcmFndWxhTW9kZWw6ICc9J1xuICAgICAgfSxcbiAgICAgIGxpbms6IGxpbmtcbiAgICB9O1xuXG4gICAgZnVuY3Rpb24gbGluayAoc2NvcGUsIGVsZW0sIGF0dHJzKSB7XG4gICAgICB2YXIgZHJhZ3VsYVNjb3BlID0gc2NvcGUuZHJhZ3VsYVNjb3BlIHx8IHNjb3BlLiRwYXJlbnQ7XG4gICAgICB2YXIgY29udGFpbmVyID0gZWxlbVswXTtcbiAgICAgIHZhciBuYW1lID0gc2NvcGUuJGV2YWwoYXR0cnMuZHJhZ3VsYSk7XG4gICAgICB2YXIgZHJha2U7XG5cbiAgICAgIHZhciBiYWcgPSBkcmFndWxhU2VydmljZS5maW5kKGRyYWd1bGFTY29wZSwgbmFtZSk7XG4gICAgICBpZiAoYmFnKSB7XG4gICAgICAgIGRyYWtlID0gYmFnLmRyYWtlO1xuICAgICAgICBkcmFrZS5jb250YWluZXJzLnB1c2goY29udGFpbmVyKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRyYWtlID0gZHJhZ3VsYSh7XG4gICAgICAgICAgY29udGFpbmVyczogW2NvbnRhaW5lcl1cbiAgICAgICAgfSk7XG4gICAgICAgIGRyYWd1bGFTZXJ2aWNlLmFkZChkcmFndWxhU2NvcGUsIG5hbWUsIGRyYWtlKTtcbiAgICAgIH1cblxuXHRcdFx0c2NvcGUuJG9uKCckZGVzdHJveScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRkcmFndWxhU2VydmljZS5kZXN0cm95KGRyYWd1bGFTY29wZSwgbmFtZSk7XG5cdFx0XHR9KTtcblxuICAgICAgc2NvcGUuJHdhdGNoKCdkcmFndWxhTW9kZWwnLCBmdW5jdGlvbiAobmV3VmFsdWUsIG9sZFZhbHVlKSB7XG4gICAgICAgIGlmICghbmV3VmFsdWUpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZHJha2UubW9kZWxzKSB7XG4gICAgICAgICAgdmFyIG1vZGVsSW5kZXggPSBvbGRWYWx1ZSA/IGRyYWtlLm1vZGVscy5pbmRleE9mKG9sZFZhbHVlKSA6IC0xO1xuICAgICAgICAgIGlmIChtb2RlbEluZGV4ID49IDApIHtcbiAgICAgICAgICAgIGRyYWtlLm1vZGVscy5zcGxpY2UobW9kZWxJbmRleCwgMSwgbmV3VmFsdWUpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkcmFrZS5tb2RlbHMucHVzaChuZXdWYWx1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGRyYWtlLm1vZGVscyA9IFtuZXdWYWx1ZV07XG4gICAgICAgIH1cblxuICAgICAgICBkcmFndWxhU2VydmljZS5oYW5kbGVNb2RlbHMoZHJhZ3VsYVNjb3BlLCBkcmFrZSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1dO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlZ2lzdGVyO1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdG9hIChhLCBuKSB7IHJldHVybiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhLCBuKTsgfVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdGlja3kgPSByZXF1aXJlKCd0aWNreScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGRlYm91bmNlIChmbiwgYXJncywgY3R4KSB7XG4gIGlmICghZm4pIHsgcmV0dXJuOyB9XG4gIHRpY2t5KGZ1bmN0aW9uIHJ1biAoKSB7XG4gICAgZm4uYXBwbHkoY3R4IHx8IG51bGwsIGFyZ3MgfHwgW10pO1xuICB9KTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdG9hID0gcmVxdWlyZSgnYXRvYScpO1xudmFyIGRlYm91bmNlID0gcmVxdWlyZSgnLi9kZWJvdW5jZScpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVtaXR0ZXIgKHRoaW5nLCBvcHRpb25zKSB7XG4gIHZhciBvcHRzID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGV2dCA9IHt9O1xuICBpZiAodGhpbmcgPT09IHVuZGVmaW5lZCkgeyB0aGluZyA9IHt9OyB9XG4gIHRoaW5nLm9uID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgaWYgKCFldnRbdHlwZV0pIHtcbiAgICAgIGV2dFt0eXBlXSA9IFtmbl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGV2dFt0eXBlXS5wdXNoKGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGZuKSB7XG4gICAgZm4uX29uY2UgPSB0cnVlOyAvLyB0aGluZy5vZmYoZm4pIHN0aWxsIHdvcmtzIVxuICAgIHRoaW5nLm9uKHR5cGUsIGZuKTtcbiAgICByZXR1cm4gdGhpbmc7XG4gIH07XG4gIHRoaW5nLm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBmbikge1xuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBpZiAoYyA9PT0gMSkge1xuICAgICAgZGVsZXRlIGV2dFt0eXBlXTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDApIHtcbiAgICAgIGV2dCA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZXQgPSBldnRbdHlwZV07XG4gICAgICBpZiAoIWV0KSB7IHJldHVybiB0aGluZzsgfVxuICAgICAgZXQuc3BsaWNlKGV0LmluZGV4T2YoZm4pLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaW5nO1xuICB9O1xuICB0aGluZy5lbWl0ID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpO1xuICAgIHJldHVybiB0aGluZy5lbWl0dGVyU25hcHNob3QoYXJncy5zaGlmdCgpKS5hcHBseSh0aGlzLCBhcmdzKTtcbiAgfTtcbiAgdGhpbmcuZW1pdHRlclNuYXBzaG90ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICB2YXIgZXQgPSAoZXZ0W3R5cGVdIHx8IFtdKS5zbGljZSgwKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGFyZ3MgPSBhdG9hKGFyZ3VtZW50cyk7XG4gICAgICB2YXIgY3R4ID0gdGhpcyB8fCB0aGluZztcbiAgICAgIGlmICh0eXBlID09PSAnZXJyb3InICYmIG9wdHMudGhyb3dzICE9PSBmYWxzZSAmJiAhZXQubGVuZ3RoKSB7IHRocm93IGFyZ3MubGVuZ3RoID09PSAxID8gYXJnc1swXSA6IGFyZ3M7IH1cbiAgICAgIGV0LmZvckVhY2goZnVuY3Rpb24gZW1pdHRlciAobGlzdGVuKSB7XG4gICAgICAgIGlmIChvcHRzLmFzeW5jKSB7IGRlYm91bmNlKGxpc3RlbiwgYXJncywgY3R4KTsgfSBlbHNlIHsgbGlzdGVuLmFwcGx5KGN0eCwgYXJncyk7IH1cbiAgICAgICAgaWYgKGxpc3Rlbi5fb25jZSkgeyB0aGluZy5vZmYodHlwZSwgbGlzdGVuKTsgfVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gdGhpbmc7XG4gICAgfTtcbiAgfTtcbiAgcmV0dXJuIHRoaW5nO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnY3VzdG9tLWV2ZW50Jyk7XG52YXIgZXZlbnRtYXAgPSByZXF1aXJlKCcuL2V2ZW50bWFwJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGFkZDogYWRkRXZlbnQsXG4gIHJlbW92ZTogcmVtb3ZlRXZlbnQsXG4gIGZhYnJpY2F0ZTogZmFicmljYXRlRXZlbnRcbn07XG5cbmZ1bmN0aW9uIGFkZEV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIGFkZEV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5hdHRhY2hFdmVudCgnb24nICsgdHlwZSwgd3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGxpc3RlbmVyID0gdW53cmFwKGVsLCB0eXBlLCBmbik7XG4gIGlmIChsaXN0ZW5lcikge1xuICAgIHJldHVybiBlbC5kZXRhY2hFdmVudCgnb24nICsgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZhYnJpY2F0ZUV2ZW50IChlbCwgdHlwZSwgbW9kZWwpIHtcbiAgdmFyIGUgPSBldmVudG1hcC5pbmRleE9mKHR5cGUpID09PSAtMSA/IG1ha2VDdXN0b21FdmVudCgpIDogbWFrZUNsYXNzaWNFdmVudCgpO1xuICBpZiAoZWwuZGlzcGF0Y2hFdmVudCkge1xuICAgIGVsLmRpc3BhdGNoRXZlbnQoZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuZmlyZUV2ZW50KCdvbicgKyB0eXBlLCBlKTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ2xhc3NpY0V2ZW50ICgpIHtcbiAgICB2YXIgZTtcbiAgICBpZiAoZG9jLmNyZWF0ZUV2ZW50KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50KCdFdmVudCcpO1xuICAgICAgZS5pbml0RXZlbnQodHlwZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfSBlbHNlIGlmIChkb2MuY3JlYXRlRXZlbnRPYmplY3QpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgICB9XG4gICAgcmV0dXJuIGU7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUN1c3RvbUV2ZW50ICgpIHtcbiAgICByZXR1cm4gbmV3IGN1c3RvbUV2ZW50KHR5cGUsIHsgZGV0YWlsOiBtb2RlbCB9KTtcbiAgfVxufVxuXG5mdW5jdGlvbiB3cmFwcGVyRmFjdG9yeSAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwcGVyIChvcmlnaW5hbEV2ZW50KSB7XG4gICAgdmFyIGUgPSBvcmlnaW5hbEV2ZW50IHx8IGdsb2JhbC5ldmVudDtcbiAgICBlLnRhcmdldCA9IGUudGFyZ2V0IHx8IGUuc3JjRWxlbWVudDtcbiAgICBlLnByZXZlbnREZWZhdWx0ID0gZS5wcmV2ZW50RGVmYXVsdCB8fCBmdW5jdGlvbiBwcmV2ZW50RGVmYXVsdCAoKSB7IGUucmV0dXJuVmFsdWUgPSBmYWxzZTsgfTtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbiA9IGUuc3RvcFByb3BhZ2F0aW9uIHx8IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbiAoKSB7IGUuY2FuY2VsQnViYmxlID0gdHJ1ZTsgfTtcbiAgICBlLndoaWNoID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgZm4uY2FsbChlbCwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHdyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgd3JhcHBlciA9IHVud3JhcChlbCwgdHlwZSwgZm4pIHx8IHdyYXBwZXJGYWN0b3J5KGVsLCB0eXBlLCBmbik7XG4gIGhhcmRDYWNoZS5wdXNoKHtcbiAgICB3cmFwcGVyOiB3cmFwcGVyLFxuICAgIGVsZW1lbnQ6IGVsLFxuICAgIHR5cGU6IHR5cGUsXG4gICAgZm46IGZuXG4gIH0pO1xuICByZXR1cm4gd3JhcHBlcjtcbn1cblxuZnVuY3Rpb24gdW53cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGkgPSBmaW5kKGVsLCB0eXBlLCBmbik7XG4gIGlmIChpKSB7XG4gICAgdmFyIHdyYXBwZXIgPSBoYXJkQ2FjaGVbaV0ud3JhcHBlcjtcbiAgICBoYXJkQ2FjaGUuc3BsaWNlKGksIDEpOyAvLyBmcmVlIHVwIGEgdGFkIG9mIG1lbW9yeVxuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmQgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSwgaXRlbTtcbiAgZm9yIChpID0gMDsgaSA8IGhhcmRDYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGl0ZW0gPSBoYXJkQ2FjaGVbaV07XG4gICAgaWYgKGl0ZW0uZWxlbWVudCA9PT0gZWwgJiYgaXRlbS50eXBlID09PSB0eXBlICYmIGl0ZW0uZm4gPT09IGZuKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbn1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGV2ZW50bWFwID0gW107XG52YXIgZXZlbnRuYW1lID0gJyc7XG52YXIgcm9uID0gL15vbi87XG5cbmZvciAoZXZlbnRuYW1lIGluIGdsb2JhbCkge1xuICBpZiAocm9uLnRlc3QoZXZlbnRuYW1lKSkge1xuICAgIGV2ZW50bWFwLnB1c2goZXZlbnRuYW1lLnNsaWNlKDIpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV2ZW50bWFwO1xuIiwiXG52YXIgTmF0aXZlQ3VzdG9tRXZlbnQgPSBnbG9iYWwuQ3VzdG9tRXZlbnQ7XG5cbmZ1bmN0aW9uIHVzZU5hdGl2ZSAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIHAgPSBuZXcgTmF0aXZlQ3VzdG9tRXZlbnQoJ2NhdCcsIHsgZGV0YWlsOiB7IGZvbzogJ2JhcicgfSB9KTtcbiAgICByZXR1cm4gICdjYXQnID09PSBwLnR5cGUgJiYgJ2JhcicgPT09IHAuZGV0YWlsLmZvbztcbiAgfSBjYXRjaCAoZSkge1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLyoqXG4gKiBDcm9zcy1icm93c2VyIGBDdXN0b21FdmVudGAgY29uc3RydWN0b3IuXG4gKlxuICogaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL0N1c3RvbUV2ZW50LkN1c3RvbUV2ZW50XG4gKlxuICogQHB1YmxpY1xuICovXG5cbm1vZHVsZS5leHBvcnRzID0gdXNlTmF0aXZlKCkgPyBOYXRpdmVDdXN0b21FdmVudCA6XG5cbi8vIElFID49IDlcbidmdW5jdGlvbicgPT09IHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFdmVudCA/IGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnQ3VzdG9tRXZlbnQnKTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCk7XG4gIH0gZWxzZSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgZmFsc2UsIGZhbHNlLCB2b2lkIDApO1xuICB9XG4gIHJldHVybiBlO1xufSA6XG5cbi8vIElFIDw9IDhcbmZ1bmN0aW9uIEN1c3RvbUV2ZW50ICh0eXBlLCBwYXJhbXMpIHtcbiAgdmFyIGUgPSBkb2N1bWVudC5jcmVhdGVFdmVudE9iamVjdCgpO1xuICBlLnR5cGUgPSB0eXBlO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5idWJibGVzID0gQm9vbGVhbihwYXJhbXMuYnViYmxlcyk7XG4gICAgZS5jYW5jZWxhYmxlID0gQm9vbGVhbihwYXJhbXMuY2FuY2VsYWJsZSk7XG4gICAgZS5kZXRhaWwgPSBwYXJhbXMuZGV0YWlsO1xuICB9IGVsc2Uge1xuICAgIGUuYnViYmxlcyA9IGZhbHNlO1xuICAgIGUuY2FuY2VsYWJsZSA9IGZhbHNlO1xuICAgIGUuZGV0YWlsID0gdm9pZCAwO1xuICB9XG4gIHJldHVybiBlO1xufVxuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZW1pdHRlciA9IHJlcXVpcmUoJ2NvbnRyYS9lbWl0dGVyJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZmFzdGRvbSA9IHJlcXVpcmUoJ2Zhc3Rkb20nKTtcbnZhciBmYXN0ZG9tUHJvbWlzZWQgPSByZXF1aXJlKCdmYXN0ZG9tL2V4dGVuc2lvbnMvZmFzdGRvbS1wcm9taXNlZCcpO1xuXG52YXIgZmQgPSBmYXN0ZG9tLmV4dGVuZChmYXN0ZG9tUHJvbWlzZWQpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGRvY3VtZW50RWxlbWVudCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbmZ1bmN0aW9uIGRyYWd1bGEoaW5pdGlhbENvbnRhaW5lcnMsIG9wdGlvbnMpIHtcblx0dmFyIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG5cdGlmIChsZW4gPT09IDEgJiYgQXJyYXkuaXNBcnJheShpbml0aWFsQ29udGFpbmVycykgPT09IGZhbHNlKSB7XG5cdFx0b3B0aW9ucyA9IGluaXRpYWxDb250YWluZXJzO1xuXHRcdGluaXRpYWxDb250YWluZXJzID0gW107XG5cdH1cblx0dmFyIF9taXJyb3I7IC8vIG1pcnJvciBpbWFnZVxuXHR2YXIgX3NvdXJjZTsgLy8gc291cmNlIGNvbnRhaW5lclxuXHR2YXIgX2l0ZW07IC8vIGl0ZW0gYmVpbmcgZHJhZ2dlZFxuXHR2YXIgX29mZnNldFg7IC8vIHJlZmVyZW5jZSB4XG5cdHZhciBfb2Zmc2V0WTsgLy8gcmVmZXJlbmNlIHlcblx0dmFyIF9tb3ZlWDsgLy8gcmVmZXJlbmNlIG1vdmUgeFxuXHR2YXIgX21vdmVZOyAvLyByZWZlcmVuY2UgbW92ZSB5XG5cdHZhciBfaW5pdGlhbFNpYmxpbmc7IC8vIHJlZmVyZW5jZSBzaWJsaW5nIHdoZW4gZ3JhYmJlZFxuXHR2YXIgX2N1cnJlbnRTaWJsaW5nOyAvLyByZWZlcmVuY2Ugc2libGluZyBub3dcblx0dmFyIF9jb3B5OyAvLyBpdGVtIHVzZWQgZm9yIGNvcHlpbmdcblx0dmFyIF9yZW5kZXJUaW1lcjsgLy8gdGltZXIgZm9yIHNldFRpbWVvdXQgcmVuZGVyTWlycm9ySW1hZ2Vcblx0dmFyIF9sYXN0RHJvcFRhcmdldCA9IG51bGw7IC8vIGxhc3QgY29udGFpbmVyIGl0ZW0gd2FzIG92ZXJcblx0dmFyIF9ncmFiYmVkOyAvLyBob2xkcyBtb3VzZWRvd24gY29udGV4dCB1bnRpbCBmaXJzdCBtb3VzZW1vdmVcblxuXHR2YXIgbyA9IG9wdGlvbnMgfHwge307XG5cdGlmIChvLm1vdmVzID09PSB2b2lkIDApIHtcblx0XHRvLm1vdmVzID0gYWx3YXlzO1xuXHR9XG5cdGlmIChvLmFjY2VwdHMgPT09IHZvaWQgMCkge1xuXHRcdG8uYWNjZXB0cyA9IGFsd2F5cztcblx0fVxuXHRpZiAoby5pbnZhbGlkID09PSB2b2lkIDApIHtcblx0XHRvLmludmFsaWQgPSBpbnZhbGlkVGFyZ2V0O1xuXHR9XG5cdGlmIChvLmNvbnRhaW5lcnMgPT09IHZvaWQgMCkge1xuXHRcdG8uY29udGFpbmVycyA9IGluaXRpYWxDb250YWluZXJzIHx8IFtdO1xuXHR9XG5cdGlmIChvLmlzQ29udGFpbmVyID09PSB2b2lkIDApIHtcblx0XHRvLmlzQ29udGFpbmVyID0gbmV2ZXI7XG5cdH1cblx0aWYgKG8uY29weSA9PT0gdm9pZCAwKSB7XG5cdFx0by5jb3B5ID0gZmFsc2U7XG5cdH1cblx0aWYgKG8uY29weVNvcnRTb3VyY2UgPT09IHZvaWQgMCkge1xuXHRcdG8uY29weVNvcnRTb3VyY2UgPSBmYWxzZTtcblx0fVxuXHRpZiAoby5yZXZlcnRPblNwaWxsID09PSB2b2lkIDApIHtcblx0XHRvLnJldmVydE9uU3BpbGwgPSBmYWxzZTtcblx0fVxuXHRpZiAoby5yZW1vdmVPblNwaWxsID09PSB2b2lkIDApIHtcblx0XHRvLnJlbW92ZU9uU3BpbGwgPSBmYWxzZTtcblx0fVxuXHRpZiAoby5kaXJlY3Rpb24gPT09IHZvaWQgMCkge1xuXHRcdG8uZGlyZWN0aW9uID0gJ3ZlcnRpY2FsJztcblx0fVxuXHRpZiAoby5pZ25vcmVJbnB1dFRleHRTZWxlY3Rpb24gPT09IHZvaWQgMCkge1xuXHRcdG8uaWdub3JlSW5wdXRUZXh0U2VsZWN0aW9uID0gdHJ1ZTtcblx0fVxuXHRpZiAoby5taXJyb3JDb250YWluZXIgPT09IHZvaWQgMCkge1xuXHRcdG8ubWlycm9yQ29udGFpbmVyID0gZG9jLmJvZHk7XG5cdH1cblxuXHR2YXIgZHJha2UgPSBlbWl0dGVyKHtcblx0XHRjb250YWluZXJzOiBvLmNvbnRhaW5lcnMsXG5cdFx0c3RhcnQ6IG1hbnVhbFN0YXJ0LFxuXHRcdGVuZDogZW5kLFxuXHRcdGNhbmNlbDogY2FuY2VsLFxuXHRcdHJlbW92ZTogcmVtb3ZlLFxuXHRcdGRlc3Ryb3k6IGRlc3Ryb3ksXG5cdFx0Y2FuTW92ZTogY2FuTW92ZSxcblx0XHRkcmFnZ2luZzogZmFsc2Vcblx0fSk7XG5cblx0aWYgKG8ucmVtb3ZlT25TcGlsbCA9PT0gdHJ1ZSkge1xuXHRcdGRyYWtlLm9uKCdvdmVyJywgc3BpbGxPdmVyKS5vbignb3V0Jywgc3BpbGxPdXQpO1xuXHR9XG5cblx0ZXZlbnRzKCk7XG5cblx0cmV0dXJuIGRyYWtlO1xuXG5cdGZ1bmN0aW9uIGlzQ29udGFpbmVyKGVsKSB7XG5cdFx0cmV0dXJuIGRyYWtlLmNvbnRhaW5lcnMuaW5kZXhPZihlbCkgIT09IC0xIHx8IG8uaXNDb250YWluZXIoZWwpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXZlbnRzKHJlbW92ZSkge1xuXHRcdHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG5cdFx0dG91Y2h5KGRvY3VtZW50RWxlbWVudCwgb3AsICdtb3VzZWRvd24nLCBncmFiKTtcblx0XHR0b3VjaHkoZG9jdW1lbnRFbGVtZW50LCBvcCwgJ21vdXNldXAnLCByZWxlYXNlKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGV2ZW50dWFsTW92ZW1lbnRzKHJlbW92ZSkge1xuXHRcdHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG5cdFx0dG91Y2h5KGRvY3VtZW50RWxlbWVudCwgb3AsICdtb3VzZW1vdmUnLCBzdGFydEJlY2F1c2VNb3VzZU1vdmVkKTtcblx0fVxuXG5cdGZ1bmN0aW9uIG1vdmVtZW50cyhyZW1vdmUpIHtcblx0XHR2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuXHRcdGNyb3NzdmVudFtvcF0oZG9jdW1lbnRFbGVtZW50LCAnc2VsZWN0c3RhcnQnLCBwcmV2ZW50R3JhYmJlZCk7IC8vIElFOFxuXHRcdGNyb3NzdmVudFtvcF0oZG9jdW1lbnRFbGVtZW50LCAnY2xpY2snLCBwcmV2ZW50R3JhYmJlZCk7XG5cdH1cblxuXHRmdW5jdGlvbiBkZXN0cm95KCkge1xuXHRcdGV2ZW50cyh0cnVlKTtcblx0XHRyZWxlYXNlKHt9KTtcblx0fVxuXG5cdGZ1bmN0aW9uIHByZXZlbnRHcmFiYmVkKGUpIHtcblx0XHRpZiAoX2dyYWJiZWQpIHtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBncmFiKGUpIHtcblx0XHRfbW92ZVggPSBlLmNsaWVudFg7XG5cdFx0X21vdmVZID0gZS5jbGllbnRZO1xuXG5cdFx0dmFyIGlnbm9yZSA9IHdoaWNoTW91c2VCdXR0b24oZSkgIT09IDEgfHwgZS5tZXRhS2V5IHx8IGUuY3RybEtleTtcblx0XHRpZiAoaWdub3JlKSB7XG5cdFx0XHRyZXR1cm47IC8vIHdlIG9ubHkgY2FyZSBhYm91dCBob25lc3QtdG8tZ29kIGxlZnQgY2xpY2tzIGFuZCB0b3VjaCBldmVudHNcblx0XHR9XG5cdFx0dmFyIGl0ZW0gPSBlLnRhcmdldDtcblx0XHR2YXIgY29udGV4dCA9IGNhblN0YXJ0KGl0ZW0pO1xuXHRcdGlmICghY29udGV4dCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRfZ3JhYmJlZCA9IGNvbnRleHQ7XG5cdFx0ZXZlbnR1YWxNb3ZlbWVudHMoKTtcblx0XHRpZiAoZS50eXBlID09PSAnbW91c2Vkb3duJykge1xuXHRcdFx0aWYgKGlzSW5wdXQoaXRlbSkpIHsgLy8gc2VlIGFsc286IGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8yMDhcblx0XHRcdFx0aXRlbS5mb2N1cygpOyAvLyBmaXhlcyBodHRwczovL2dpdGh1Yi5jb20vYmV2YWNxdWEvZHJhZ3VsYS9pc3N1ZXMvMTc2XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7IC8vIGZpeGVzIGh0dHBzOi8vZ2l0aHViLmNvbS9iZXZhY3F1YS9kcmFndWxhL2lzc3Vlcy8xNTVcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzdGFydEJlY2F1c2VNb3VzZU1vdmVkKGUpIHtcblx0XHRpZiAoIV9ncmFiYmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh3aGljaE1vdXNlQnV0dG9uKGUpID09PSAwKSB7XG5cdFx0XHRyZWxlYXNlKHt9KTtcblx0XHRcdHJldHVybjsgLy8gd2hlbiB0ZXh0IGlzIHNlbGVjdGVkIG9uIGFuIGlucHV0IGFuZCB0aGVuIGRyYWdnZWQsIG1vdXNldXAgZG9lc24ndCBmaXJlLiB0aGlzIGlzIG91ciBvbmx5IGhvcGVcblx0XHR9XG5cdFx0Ly8gdHJ1dGh5IGNoZWNrIGZpeGVzICMyMzksIGVxdWFsaXR5IGZpeGVzICMyMDdcblx0XHRpZiAoZS5jbGllbnRYICE9PSB2b2lkIDAgJiYgZS5jbGllbnRYID09PSBfbW92ZVggJiYgZS5jbGllbnRZICE9PSB2b2lkIDAgJiYgZS5jbGllbnRZID09PSBfbW92ZVkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKG8uaWdub3JlSW5wdXRUZXh0U2VsZWN0aW9uKSB7XG5cdFx0XHR2YXIgY2xpZW50WCA9IGdldENvb3JkKCdjbGllbnRYJywgZSk7XG5cdFx0XHR2YXIgY2xpZW50WSA9IGdldENvb3JkKCdjbGllbnRZJywgZSk7XG5cdFx0XHR2YXIgZWxlbWVudEJlaGluZEN1cnNvciA9IGRvYy5lbGVtZW50RnJvbVBvaW50KGNsaWVudFgsIGNsaWVudFkpO1xuXHRcdFx0aWYgKGlzSW5wdXQoZWxlbWVudEJlaGluZEN1cnNvcikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHZhciBncmFiYmVkID0gX2dyYWJiZWQ7IC8vIGNhbGwgdG8gZW5kKCkgdW5zZXRzIF9ncmFiYmVkXG5cdFx0ZXZlbnR1YWxNb3ZlbWVudHModHJ1ZSk7XG5cdFx0bW92ZW1lbnRzKCk7XG5cdFx0ZW5kKCk7XG5cdFx0c3RhcnQoZ3JhYmJlZCk7XG5cblx0XHR2YXIgb2Zmc2V0ID0gZ2V0T2Zmc2V0KF9pdGVtKTtcblx0XHRfb2Zmc2V0WCA9IGdldENvb3JkKCdwYWdlWCcsIGUpIC0gb2Zmc2V0LmxlZnQ7XG5cdFx0X29mZnNldFkgPSBnZXRDb29yZCgncGFnZVknLCBlKSAtIG9mZnNldC50b3A7XG5cblx0XHQoX2NvcHkgfHwgX2l0ZW0pLmNsYXNzTGlzdC5hZGQoJ2d1LXRyYW5zaXQnKTtcblxuXHRcdHJlbmRlck1pcnJvckltYWdlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdGRyYWcoZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRmdW5jdGlvbiBjYW5TdGFydChpdGVtKSB7XG5cdFx0aWYgKGRyYWtlLmRyYWdnaW5nICYmIF9taXJyb3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGlzQ29udGFpbmVyKGl0ZW0pKSB7XG5cdFx0XHRyZXR1cm47IC8vIGRvbid0IGRyYWcgY29udGFpbmVyIGl0c2VsZlxuXHRcdH1cblx0XHR2YXIgaGFuZGxlID0gaXRlbTtcblx0XHR3aGlsZSAoZ2V0UGFyZW50KGl0ZW0pICYmIGlzQ29udGFpbmVyKGdldFBhcmVudChpdGVtKSkgPT09IGZhbHNlKSB7XG5cdFx0XHRpZiAoby5pbnZhbGlkKGl0ZW0sIGhhbmRsZSkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aXRlbSA9IGdldFBhcmVudChpdGVtKTsgLy8gZHJhZyB0YXJnZXQgc2hvdWxkIGJlIGEgdG9wIGVsZW1lbnRcblx0XHRcdGlmICghaXRlbSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHZhciBzb3VyY2UgPSBnZXRQYXJlbnQoaXRlbSk7XG5cdFx0aWYgKCFzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKG8uaW52YWxpZChpdGVtLCBoYW5kbGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFyIG1vdmFibGUgPSBvLm1vdmVzKGl0ZW0sIHNvdXJjZSwgaGFuZGxlLCBuZXh0RWwoaXRlbSkpO1xuXHRcdGlmICghbW92YWJsZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRpdGVtOiBpdGVtLFxuXHRcdFx0c291cmNlOiBzb3VyY2Vcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gY2FuTW92ZShpdGVtKSB7XG5cdFx0cmV0dXJuICEhY2FuU3RhcnQoaXRlbSk7XG5cdH1cblxuXHRmdW5jdGlvbiBtYW51YWxTdGFydChpdGVtKSB7XG5cdFx0dmFyIGNvbnRleHQgPSBjYW5TdGFydChpdGVtKTtcblx0XHRpZiAoY29udGV4dCkge1xuXHRcdFx0c3RhcnQoY29udGV4dCk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gc3RhcnQoY29udGV4dCkge1xuXHRcdGlmIChpc0NvcHkoY29udGV4dC5pdGVtLCBjb250ZXh0LnNvdXJjZSkpIHtcblx0XHRcdF9jb3B5ID0gY29udGV4dC5pdGVtLmNsb25lTm9kZSh0cnVlKTtcblx0XHRcdGRyYWtlLmVtaXQoJ2Nsb25lZCcsIF9jb3B5LCBjb250ZXh0Lml0ZW0sICdjb3B5Jyk7XG5cdFx0fVxuXG5cdFx0X3NvdXJjZSA9IGNvbnRleHQuc291cmNlO1xuXHRcdF9pdGVtID0gY29udGV4dC5pdGVtO1xuXHRcdF9pbml0aWFsU2libGluZyA9IF9jdXJyZW50U2libGluZyA9IG5leHRFbChjb250ZXh0Lml0ZW0pO1xuXG5cdFx0ZHJha2UuZHJhZ2dpbmcgPSB0cnVlO1xuXHRcdGRyYWtlLmVtaXQoJ2RyYWcnLCBfaXRlbSwgX3NvdXJjZSk7XG5cdH1cblxuXHRmdW5jdGlvbiBpbnZhbGlkVGFyZ2V0KCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZ1bmN0aW9uIGVuZCgpIHtcblx0XHRpZiAoIWRyYWtlLmRyYWdnaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBpdGVtID0gX2NvcHkgfHwgX2l0ZW07XG5cdFx0ZHJvcChpdGVtLCBnZXRQYXJlbnQoaXRlbSkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gdW5ncmFiKCkge1xuXHRcdF9ncmFiYmVkID0gZmFsc2U7XG5cdFx0ZXZlbnR1YWxNb3ZlbWVudHModHJ1ZSk7XG5cdFx0bW92ZW1lbnRzKHRydWUpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVsZWFzZShlKSB7XG5cdFx0dW5ncmFiKCk7XG5cblx0XHRpZiAoIWRyYWtlLmRyYWdnaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcblx0XHR2YXIgY2xpZW50WCA9IGdldENvb3JkKCdjbGllbnRYJywgZSk7XG5cdFx0dmFyIGNsaWVudFkgPSBnZXRDb29yZCgnY2xpZW50WScsIGUpO1xuXHRcdHZhciBlbGVtZW50QmVoaW5kQ3Vyc29yID0gZ2V0RWxlbWVudEJlaGluZFBvaW50KF9taXJyb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuXHRcdHZhciBkcm9wVGFyZ2V0ID0gZmluZERyb3BUYXJnZXQoZWxlbWVudEJlaGluZEN1cnNvciwgY2xpZW50WCwgY2xpZW50WSk7XG5cdFx0aWYgKGRyb3BUYXJnZXQgJiYgKChfY29weSAmJiBvLmNvcHlTb3J0U291cmNlKSB8fCAoIV9jb3B5IHx8IGRyb3BUYXJnZXQgIT09IF9zb3VyY2UpKSkge1xuXHRcdFx0ZHJvcChpdGVtLCBkcm9wVGFyZ2V0KTtcblx0XHR9IGVsc2UgaWYgKG8ucmVtb3ZlT25TcGlsbCkge1xuXHRcdFx0cmVtb3ZlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHR9XG5cblx0ZnVuY3Rpb24gZHJvcChpdGVtLCB0YXJnZXQpIHtcblx0XHR2YXIgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuXHRcdGlmIChfY29weSAmJiBvLmNvcHlTb3J0U291cmNlICYmIHRhcmdldCA9PT0gX3NvdXJjZSkge1xuXHRcdFx0cGFyZW50LnJlbW92ZUNoaWxkKF9pdGVtKTtcblx0XHR9XG5cdFx0aWYgKGlzSW5pdGlhbFBsYWNlbWVudCh0YXJnZXQpKSB7XG5cdFx0XHRkcmFrZS5lbWl0KCdjYW5jZWwnLCBpdGVtLCBfc291cmNlLCBfc291cmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZHJha2UuZW1pdCgnZHJvcCcsIGl0ZW0sIHRhcmdldCwgX3NvdXJjZSwgX2N1cnJlbnRTaWJsaW5nKTtcblx0XHR9XG5cdFx0Y2xlYW51cCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVtb3ZlKCkge1xuXHRcdGlmICghZHJha2UuZHJhZ2dpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcblx0XHR2YXIgcGFyZW50ID0gZ2V0UGFyZW50KGl0ZW0pO1xuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdHBhcmVudC5yZW1vdmVDaGlsZChpdGVtKTtcblx0XHR9XG5cdFx0ZHJha2UuZW1pdChfY29weSA/ICdjYW5jZWwnIDogJ3JlbW92ZScsIGl0ZW0sIHBhcmVudCwgX3NvdXJjZSk7XG5cdFx0Y2xlYW51cCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY2FuY2VsKHJldmVydCkge1xuXHRcdGlmICghZHJha2UuZHJhZ2dpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIHJldmVydHMgPSBhcmd1bWVudHMubGVuZ3RoID4gMCA/IHJldmVydCA6IG8ucmV2ZXJ0T25TcGlsbDtcblx0XHR2YXIgaXRlbSA9IF9jb3B5IHx8IF9pdGVtO1xuXHRcdHZhciBwYXJlbnQgPSBnZXRQYXJlbnQoaXRlbSk7XG5cdFx0dmFyIGluaXRpYWwgPSBpc0luaXRpYWxQbGFjZW1lbnQocGFyZW50KTtcblx0XHRpZiAoaW5pdGlhbCA9PT0gZmFsc2UgJiYgcmV2ZXJ0cykge1xuXHRcdFx0aWYgKF9jb3B5KSB7XG5cdFx0XHRcdHBhcmVudC5yZW1vdmVDaGlsZChfY29weSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRfc291cmNlLmluc2VydEJlZm9yZShpdGVtLCBfaW5pdGlhbFNpYmxpbmcpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoaW5pdGlhbCB8fCByZXZlcnRzKSB7XG5cdFx0XHRkcmFrZS5lbWl0KCdjYW5jZWwnLCBpdGVtLCBfc291cmNlLCBfc291cmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZHJha2UuZW1pdCgnZHJvcCcsIGl0ZW0sIHBhcmVudCwgX3NvdXJjZSwgX2N1cnJlbnRTaWJsaW5nKTtcblx0XHR9XG5cdFx0Y2xlYW51cCgpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY2xlYW51cCgpIHtcblx0XHR2YXIgaXRlbSA9IF9jb3B5IHx8IF9pdGVtO1xuXHRcdHVuZ3JhYigpO1xuXHRcdHJlbW92ZU1pcnJvckltYWdlKCk7XG5cdFx0aWYgKGl0ZW0pIHtcblx0XHRcdGl0ZW0uY2xhc3NMaXN0LnJlbW92ZSgnZ3UtdHJhbnNpdCcpO1xuXHRcdH1cblx0XHRpZiAoX3JlbmRlclRpbWVyKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQoX3JlbmRlclRpbWVyKTtcblx0XHR9XG5cdFx0ZHJha2UuZHJhZ2dpbmcgPSBmYWxzZTtcblx0XHRpZiAoX2xhc3REcm9wVGFyZ2V0KSB7XG5cdFx0XHRkcmFrZS5lbWl0KCdvdXQnLCBpdGVtLCBfbGFzdERyb3BUYXJnZXQsIF9zb3VyY2UpO1xuXHRcdH1cblx0XHRkcmFrZS5lbWl0KCdkcmFnZW5kJywgaXRlbSk7XG5cdFx0X3NvdXJjZSA9IF9pdGVtID0gX2NvcHkgPSBfaW5pdGlhbFNpYmxpbmcgPSBfY3VycmVudFNpYmxpbmcgPSBfcmVuZGVyVGltZXIgPSBfbGFzdERyb3BUYXJnZXQgPSBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gaXNJbml0aWFsUGxhY2VtZW50KHRhcmdldCwgcykge1xuXHRcdHZhciBzaWJsaW5nO1xuXHRcdGlmIChzICE9PSB2b2lkIDApIHtcblx0XHRcdHNpYmxpbmcgPSBzO1xuXHRcdH0gZWxzZSBpZiAoX21pcnJvcikge1xuXHRcdFx0c2libGluZyA9IF9jdXJyZW50U2libGluZztcblx0XHR9IGVsc2Uge1xuXHRcdFx0c2libGluZyA9IG5leHRFbChfY29weSB8fCBfaXRlbSk7XG5cdFx0fVxuXHRcdHJldHVybiB0YXJnZXQgPT09IF9zb3VyY2UgJiYgc2libGluZyA9PT0gX2luaXRpYWxTaWJsaW5nO1xuXHR9XG5cblx0ZnVuY3Rpb24gZmluZERyb3BUYXJnZXQoZWxlbWVudEJlaGluZEN1cnNvciwgY2xpZW50WCwgY2xpZW50WSkge1xuXHRcdHZhciB0YXJnZXQgPSBlbGVtZW50QmVoaW5kQ3Vyc29yO1xuXHRcdHdoaWxlICh0YXJnZXQgJiYgIWFjY2VwdGVkKCkpIHtcblx0XHRcdHRhcmdldCA9IGdldFBhcmVudCh0YXJnZXQpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGFyZ2V0O1xuXG5cdFx0ZnVuY3Rpb24gYWNjZXB0ZWQoKSB7XG5cdFx0XHR2YXIgZHJvcHBhYmxlID0gaXNDb250YWluZXIodGFyZ2V0KTtcblx0XHRcdGlmIChkcm9wcGFibGUgPT09IGZhbHNlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGltbWVkaWF0ZSA9IGdldEltbWVkaWF0ZUNoaWxkKHRhcmdldCwgZWxlbWVudEJlaGluZEN1cnNvcik7XG5cdFx0XHR2YXIgcmVmZXJlbmNlID0gZ2V0UmVmZXJlbmNlKHRhcmdldCwgaW1tZWRpYXRlLCBjbGllbnRYLCBjbGllbnRZKTtcblx0XHRcdHZhciBpbml0aWFsID0gaXNJbml0aWFsUGxhY2VtZW50KHRhcmdldCwgcmVmZXJlbmNlKTtcblx0XHRcdGlmIChpbml0aWFsKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlOyAvLyBzaG91bGQgYWx3YXlzIGJlIGFibGUgdG8gZHJvcCBpdCByaWdodCBiYWNrIHdoZXJlIGl0IHdhc1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG8uYWNjZXB0cyhfaXRlbSwgdGFyZ2V0LCBfc291cmNlLCByZWZlcmVuY2UpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGRyYWcoZSkge1xuXHRcdGlmICghX21pcnJvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cblx0XHR2YXIgY2xpZW50WCA9IGdldENvb3JkKCdjbGllbnRYJywgZSk7XG5cdFx0dmFyIGNsaWVudFkgPSBnZXRDb29yZCgnY2xpZW50WScsIGUpO1xuXHRcdHZhciB4ID0gY2xpZW50WCAtIF9vZmZzZXRYO1xuXHRcdHZhciB5ID0gY2xpZW50WSAtIF9vZmZzZXRZO1xuXG5cdFx0dmFyIGl0ZW0gPSBfY29weSB8fCBfaXRlbTtcblx0XHR2YXIgZWxlbWVudEJlaGluZEN1cnNvciA9IGdldEVsZW1lbnRCZWhpbmRQb2ludChfbWlycm9yLCBjbGllbnRYLCBjbGllbnRZKTtcblx0XHR2YXIgZHJvcFRhcmdldCA9IGZpbmREcm9wVGFyZ2V0KGVsZW1lbnRCZWhpbmRDdXJzb3IsIGNsaWVudFgsIGNsaWVudFkpO1xuXG5cdFx0cG9zaXRpb25TaGFkb3coKTtcblx0XHRtb3ZlTWlycm9yKCk7XG5cblx0XHRmdW5jdGlvbiBwb3NpdGlvblNoYWRvdygpIHtcblx0XHRcdHZhciBjaGFuZ2VkID0gZHJvcFRhcmdldCAhPT0gbnVsbCAmJiBkcm9wVGFyZ2V0ICE9PSBfbGFzdERyb3BUYXJnZXQ7XG5cdFx0XHRpZiAoY2hhbmdlZCB8fCBkcm9wVGFyZ2V0ID09PSBudWxsKSB7XG5cdFx0XHRcdG91dCgpO1xuXHRcdFx0XHRfbGFzdERyb3BUYXJnZXQgPSBkcm9wVGFyZ2V0O1xuXHRcdFx0XHRvdmVyKCk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBwYXJlbnQgPSBnZXRQYXJlbnQoaXRlbSk7XG5cdFx0XHRpZiAoZHJvcFRhcmdldCA9PT0gX3NvdXJjZSAmJiBfY29weSAmJiAhby5jb3B5U29ydFNvdXJjZSkge1xuXHRcdFx0XHRpZiAocGFyZW50KSB7XG5cdFx0XHRcdFx0cGFyZW50LnJlbW92ZUNoaWxkKGl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dmFyIHJlZmVyZW5jZTtcblx0XHRcdHZhciBpbW1lZGlhdGUgPSBnZXRJbW1lZGlhdGVDaGlsZChkcm9wVGFyZ2V0LCBlbGVtZW50QmVoaW5kQ3Vyc29yKTtcblx0XHRcdGlmIChpbW1lZGlhdGUgIT09IG51bGwpIHtcblx0XHRcdFx0cmVmZXJlbmNlID0gZ2V0UmVmZXJlbmNlKGRyb3BUYXJnZXQsIGltbWVkaWF0ZSwgY2xpZW50WCwgY2xpZW50WSk7XG5cdFx0XHR9IGVsc2UgaWYgKG8ucmV2ZXJ0T25TcGlsbCA9PT0gdHJ1ZSAmJiAhX2NvcHkpIHtcblx0XHRcdFx0cmVmZXJlbmNlID0gX2luaXRpYWxTaWJsaW5nO1xuXHRcdFx0XHRkcm9wVGFyZ2V0ID0gX3NvdXJjZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChfY29weSAmJiBwYXJlbnQpIHtcblx0XHRcdFx0XHRwYXJlbnQucmVtb3ZlQ2hpbGQoaXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoXG5cdFx0XHRcdChyZWZlcmVuY2UgPT09IG51bGwgJiYgY2hhbmdlZCkgfHxcblx0XHRcdFx0cmVmZXJlbmNlICE9PSBpdGVtICYmXG5cdFx0XHRcdHJlZmVyZW5jZSAhPT0gbmV4dEVsKGl0ZW0pXG5cdFx0XHQpIHtcblx0XHRcdFx0X2N1cnJlbnRTaWJsaW5nID0gcmVmZXJlbmNlO1xuXG5cdFx0XHRcdGRyb3BUYXJnZXQuaW5zZXJ0QmVmb3JlKGl0ZW0sIHJlZmVyZW5jZSk7XG5cdFx0XHRcdGRyYWtlLmVtaXQoJ3NoYWRvdycsIGl0ZW0sIGRyb3BUYXJnZXQsIF9zb3VyY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBvdmVyKCkge1xuXHRcdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHRcdG1vdmVkKCdvdmVyJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZnVuY3Rpb24gb3V0KCkge1xuXHRcdFx0XHRpZiAoX2xhc3REcm9wVGFyZ2V0KSB7XG5cdFx0XHRcdFx0bW92ZWQoJ291dCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIG1vdmVkKHR5cGUpIHtcblx0XHRcdFx0ZHJha2UuZW1pdCh0eXBlLCBpdGVtLCBfbGFzdERyb3BUYXJnZXQsIF9zb3VyY2UpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG1vdmVNaXJyb3IoKSB7XG5cdFx0XHRmZC5tdXRhdGUoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciB0cmFuc2xhdGVGdW5jID0gJ3RyYW5zbGF0ZTNkKCcgKyB4ICsgJ3B4LCAnICsgeSArICdweCwgMHB4KSByb3RhdGUoLTNkZWcpJztcblxuXHRcdFx0XHRfbWlycm9yLnN0eWxlLnRyYW5zZm9ybSA9IHRyYW5zbGF0ZUZ1bmM7XG5cdFx0XHRcdF9taXJyb3Iuc3R5bGUud2Via2l0VHJhbnNmb3JtID0gdHJhbnNsYXRlRnVuYztcblx0XHRcdFx0X21pcnJvci5zdHlsZS5tc1RyYW5zZm9ybSA9IHRyYW5zbGF0ZUZ1bmM7XG5cdFx0XHRcdF9taXJyb3Iuc3R5bGUuTW96VHJhbnNmb3JtID0gdHJhbnNsYXRlRnVuYztcblx0XHRcdFx0X21pcnJvci5jbGFzc0xpc3QucmVtb3ZlKCdndS1oaWRlJyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzcGlsbE92ZXIoZWwpIHtcblx0XHRlbC5jbGFzc0xpc3QucmVtb3ZlKCdndS1oaWRlJyk7XG5cdH1cblxuXHRmdW5jdGlvbiBzcGlsbE91dChlbCkge1xuXHRcdGlmIChkcmFrZS5kcmFnZ2luZykge1xuXHRcdFx0ZWwuY2xhc3NMaXN0LmFkZCgnZ3UtaGlkZScpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHJlbmRlck1pcnJvckltYWdlKCkge1xuXHRcdGlmIChfbWlycm9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0X21pcnJvciA9IF9pdGVtLmNsb25lTm9kZSh0cnVlKTtcblxuXHRcdHZhciByZWN0ID0gX2l0ZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cblx0XHRyZXR1cm4gZmQubXV0YXRlKGZ1bmN0aW9uICgpIHtcblx0XHRcdG8ubWlycm9yQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2d1LXVuc2VsZWN0YWJsZScpO1xuXG5cdFx0XHRfbWlycm9yLnN0eWxlLndpZHRoID0gcmVjdC53aWR0aCArICdweCc7XG5cdFx0XHRfbWlycm9yLnN0eWxlLmhlaWdodCA9IHJlY3QuaGVpZ2h0ICsgJ3B4Jztcblx0XHRcdF9taXJyb3Iuc3R5bGUudG9wID0gMDtcblx0XHRcdF9taXJyb3Iuc3R5bGUubGVmdCA9IDA7XG5cblx0XHRcdF9taXJyb3IuY2xhc3NMaXN0LnJlbW92ZSgnZ3UtdHJhbnNpdCcpO1xuXHRcdFx0X21pcnJvci5jbGFzc0xpc3QuYWRkKCdndS1taXJyb3InKTtcblx0XHRcdF9taXJyb3IuY2xhc3NMaXN0LmFkZCgnZ3UtaGlkZScpO1xuXG5cdFx0XHRvLm1pcnJvckNvbnRhaW5lci5hcHBlbmRDaGlsZChfbWlycm9yKTtcblx0XHR9KS50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdHRvdWNoeShkb2N1bWVudEVsZW1lbnQsICdhZGQnLCAnbW91c2Vtb3ZlJywgZHJhZyk7XG5cdFx0XHRkcmFrZS5lbWl0KCdjbG9uZWQnLCBfbWlycm9yLCBfaXRlbSwgJ21pcnJvcicpO1xuXHRcdH0pO1xuXHR9XG5cblx0ZnVuY3Rpb24gcmVtb3ZlTWlycm9ySW1hZ2UoKSB7XG5cdFx0aWYgKF9taXJyb3IpIHtcblx0XHRcdG8ubWlycm9yQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2d1LXVuc2VsZWN0YWJsZScpO1xuXHRcdFx0dG91Y2h5KGRvY3VtZW50RWxlbWVudCwgJ3JlbW92ZScsICdtb3VzZW1vdmUnLCBkcmFnKTtcblx0XHRcdGdldFBhcmVudChfbWlycm9yKS5yZW1vdmVDaGlsZChfbWlycm9yKTtcblx0XHRcdF9taXJyb3IgPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGdldEltbWVkaWF0ZUNoaWxkKGRyb3BUYXJnZXQsIHRhcmdldCkge1xuXHRcdHZhciBpbW1lZGlhdGUgPSB0YXJnZXQ7XG5cdFx0d2hpbGUgKGltbWVkaWF0ZSAhPT0gZHJvcFRhcmdldCAmJiBnZXRQYXJlbnQoaW1tZWRpYXRlKSAhPT0gZHJvcFRhcmdldCkge1xuXHRcdFx0aW1tZWRpYXRlID0gZ2V0UGFyZW50KGltbWVkaWF0ZSk7XG5cdFx0fVxuXHRcdGlmIChpbW1lZGlhdGUgPT09IGRvY3VtZW50RWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBpbW1lZGlhdGU7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRSZWZlcmVuY2UoZHJvcFRhcmdldCwgdGFyZ2V0LCB4LCB5KSB7XG5cdFx0dmFyIGhvcml6b250YWwgPSBvLmRpcmVjdGlvbiA9PT0gJ2hvcml6b250YWwnO1xuXHRcdHZhciByZWZlcmVuY2UgPSB0YXJnZXQgIT09IGRyb3BUYXJnZXQgPyBpbnNpZGUoKSA6IG91dHNpZGUoKTtcblx0XHRyZXR1cm4gcmVmZXJlbmNlO1xuXG5cdFx0ZnVuY3Rpb24gb3V0c2lkZSgpIHsgLy8gc2xvd2VyLCBidXQgYWJsZSB0byBmaWd1cmUgb3V0IGFueSBwb3NpdGlvblxuXHRcdFx0dmFyIGxlbiA9IGRyb3BUYXJnZXQuY2hpbGRyZW4ubGVuZ3RoO1xuXHRcdFx0dmFyIGk7XG5cdFx0XHR2YXIgZWw7XG5cdFx0XHR2YXIgcmVjdDtcblx0XHRcdGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRlbCA9IGRyb3BUYXJnZXQuY2hpbGRyZW5baV07XG5cdFx0XHRcdHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdFx0aWYgKGhvcml6b250YWwgJiYgKHJlY3QubGVmdCArIHJlY3Qud2lkdGggLyAyKSA+IHgpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWw7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFob3Jpem9udGFsICYmIChyZWN0LnRvcCArIHJlY3QuaGVpZ2h0IC8gMikgPiB5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBpbnNpZGUoKSB7IC8vIGZhc3RlciwgYnV0IG9ubHkgYXZhaWxhYmxlIGlmIGRyb3BwZWQgaW5zaWRlIGEgY2hpbGQgZWxlbWVudFxuXHRcdFx0dmFyIHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0XHRpZiAoaG9yaXpvbnRhbCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzb2x2ZSh4ID4gcmVjdC5sZWZ0ICsgZ2V0UmVjdFdpZHRoKHJlY3QpIC8gMik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzb2x2ZSh5ID4gcmVjdC50b3AgKyBnZXRSZWN0SGVpZ2h0KHJlY3QpIC8gMik7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcmVzb2x2ZShhZnRlcikge1xuXHRcdFx0cmV0dXJuIGFmdGVyID8gbmV4dEVsKHRhcmdldCkgOiB0YXJnZXQ7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gaXNDb3B5KGl0ZW0sIGNvbnRhaW5lcikge1xuXHRcdHJldHVybiB0eXBlb2Ygby5jb3B5ID09PSAnYm9vbGVhbicgPyBvLmNvcHkgOiBvLmNvcHkoaXRlbSwgY29udGFpbmVyKTtcblx0fVxufVxuXG5mdW5jdGlvbiB0b3VjaHkoZWwsIG9wLCB0eXBlLCBmbikge1xuXHR2YXIgdG91Y2ggPSB7XG5cdFx0bW91c2V1cDogJ3RvdWNoZW5kJyxcblx0XHRtb3VzZWRvd246ICd0b3VjaHN0YXJ0Jyxcblx0XHRtb3VzZW1vdmU6ICd0b3VjaG1vdmUnXG5cdH07XG5cdHZhciBwb2ludGVycyA9IHtcblx0XHRtb3VzZXVwOiAncG9pbnRlcnVwJyxcblx0XHRtb3VzZWRvd246ICdwb2ludGVyZG93bicsXG5cdFx0bW91c2Vtb3ZlOiAncG9pbnRlcm1vdmUnXG5cdH07XG5cdHZhciBtaWNyb3NvZnQgPSB7XG5cdFx0bW91c2V1cDogJ01TUG9pbnRlclVwJyxcblx0XHRtb3VzZWRvd246ICdNU1BvaW50ZXJEb3duJyxcblx0XHRtb3VzZW1vdmU6ICdNU1BvaW50ZXJNb3ZlJ1xuXHR9O1xuXHRpZiAoZ2xvYmFsLm5hdmlnYXRvci5wb2ludGVyRW5hYmxlZCkge1xuXHRcdGNyb3NzdmVudFtvcF0oZWwsIHBvaW50ZXJzW3R5cGVdLCBmbik7XG5cdH0gZWxzZSBpZiAoZ2xvYmFsLm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkKSB7XG5cdFx0Y3Jvc3N2ZW50W29wXShlbCwgbWljcm9zb2Z0W3R5cGVdLCBmbik7XG5cdH0gZWxzZSB7XG5cdFx0Y3Jvc3N2ZW50W29wXShlbCwgdG91Y2hbdHlwZV0sIGZuKTtcblx0XHRjcm9zc3ZlbnRbb3BdKGVsLCB0eXBlLCBmbik7XG5cdH1cbn1cblxuZnVuY3Rpb24gd2hpY2hNb3VzZUJ1dHRvbihlKSB7XG5cdGlmIChlLnRvdWNoZXMgIT09IHZvaWQgMCkge1xuXHRcdHJldHVybiBlLnRvdWNoZXMubGVuZ3RoO1xuXHR9XG5cdGlmIChlLndoaWNoICE9PSB2b2lkIDAgJiYgZS53aGljaCAhPT0gMCkge1xuXHRcdHJldHVybiBlLndoaWNoO1xuXHR9IC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vYmV2YWNxdWEvZHJhZ3VsYS9pc3N1ZXMvMjYxXG5cdGlmIChlLmJ1dHRvbnMgIT09IHZvaWQgMCkge1xuXHRcdHJldHVybiBlLmJ1dHRvbnM7XG5cdH1cblx0dmFyIGJ1dHRvbiA9IGUuYnV0dG9uO1xuXHRpZiAoYnV0dG9uICE9PSB2b2lkIDApIHsgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9qcXVlcnkvanF1ZXJ5L2Jsb2IvOTllOGZmMWJhYTdhZTM0MWU5NGJiODljM2U4NDU3MGM3YzNhZDllYS9zcmMvZXZlbnQuanMjTDU3My1MNTc1XG5cdFx0cmV0dXJuIGJ1dHRvbiAmIDEgPyAxIDogYnV0dG9uICYgMiA/IDMgOiAoYnV0dG9uICYgNCA/IDIgOiAwKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRPZmZzZXQoZWwpIHtcblx0dmFyIHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0cmV0dXJuIHtcblx0XHRsZWZ0OiByZWN0LmxlZnQgKyBnZXRTY3JvbGwoJ3Njcm9sbExlZnQnLCAncGFnZVhPZmZzZXQnKSxcblx0XHR0b3A6IHJlY3QudG9wICsgZ2V0U2Nyb2xsKCdzY3JvbGxUb3AnLCAncGFnZVlPZmZzZXQnKVxuXHR9O1xufVxuXG5mdW5jdGlvbiBnZXRTY3JvbGwoc2Nyb2xsUHJvcCwgb2Zmc2V0UHJvcCkge1xuXHRpZiAodHlwZW9mIGdsb2JhbFtvZmZzZXRQcm9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRyZXR1cm4gZ2xvYmFsW29mZnNldFByb3BdO1xuXHR9XG5cdGlmIChkb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KSB7XG5cdFx0cmV0dXJuIGRvY3VtZW50RWxlbWVudFtzY3JvbGxQcm9wXTtcblx0fVxuXHRyZXR1cm4gZG9jLmJvZHlbc2Nyb2xsUHJvcF07XG59XG5cbmZ1bmN0aW9uIGdldEVsZW1lbnRCZWhpbmRQb2ludChwb2ludCwgeCwgeSkge1xuXHQvKlxuXHR2YXIgcCA9IHBvaW50IHx8IHt9O1xuXHR2YXIgc3RhdGUgPSBwLmNsYXNzTmFtZTtcblx0dmFyIGVsO1xuXHRwLmNsYXNzTmFtZSArPSAnIGd1LWhpZGUnO1xuXHRlbCA9IGRvYy5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xuXHRwLmNsYXNzTmFtZSA9IHN0YXRlO1xuXHRyZXR1cm4gZWw7XG5cdCovXG5cblx0cmV0dXJuIGRvYy5lbGVtZW50RnJvbVBvaW50KHgsIHkpO1xufVxuXG5mdW5jdGlvbiBuZXZlcigpIHtcblx0cmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiBhbHdheXMoKSB7XG5cdHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBnZXRSZWN0V2lkdGgocmVjdCkge1xuXHRyZXR1cm4gcmVjdC53aWR0aCB8fCAocmVjdC5yaWdodCAtIHJlY3QubGVmdCk7XG59XG5cbmZ1bmN0aW9uIGdldFJlY3RIZWlnaHQocmVjdCkge1xuXHRyZXR1cm4gcmVjdC5oZWlnaHQgfHwgKHJlY3QuYm90dG9tIC0gcmVjdC50b3ApO1xufVxuXG5mdW5jdGlvbiBnZXRQYXJlbnQoZWwpIHtcblx0cmV0dXJuIGVsLnBhcmVudE5vZGUgPT09IGRvYyA/IG51bGwgOiBlbC5wYXJlbnROb2RlO1xufVxuXG5mdW5jdGlvbiBpc0lucHV0KGVsKSB7XG5cdHJldHVybiBlbC50YWdOYW1lID09PSAnSU5QVVQnIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScgfHwgZWwudGFnTmFtZSA9PT0gJ1NFTEVDVCcgfHwgaXNFZGl0YWJsZShlbCk7XG59XG5cbmZ1bmN0aW9uIGlzRWRpdGFibGUoZWwpIHtcblx0aWYgKCFlbCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fSAvLyBubyBwYXJlbnRzIHdlcmUgZWRpdGFibGVcblx0aWYgKGVsLmNvbnRlbnRFZGl0YWJsZSA9PT0gJ2ZhbHNlJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fSAvLyBzdG9wIHRoZSBsb29rdXBcblx0aWYgKGVsLmNvbnRlbnRFZGl0YWJsZSA9PT0gJ3RydWUnKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gLy8gZm91bmQgYSBjb250ZW50RWRpdGFibGUgZWxlbWVudCBpbiB0aGUgY2hhaW5cblx0cmV0dXJuIGlzRWRpdGFibGUoZ2V0UGFyZW50KGVsKSk7IC8vIGNvbnRlbnRFZGl0YWJsZSBpcyBzZXQgdG8gJ2luaGVyaXQnXG59XG5cbmZ1bmN0aW9uIG5leHRFbChlbCkge1xuXHRyZXR1cm4gZWwubmV4dEVsZW1lbnRTaWJsaW5nIHx8IG1hbnVhbGx5KCk7XG5cblx0ZnVuY3Rpb24gbWFudWFsbHkoKSB7XG5cdFx0dmFyIHNpYmxpbmcgPSBlbDtcblx0XHRkbyB7XG5cdFx0XHRzaWJsaW5nID0gc2libGluZy5uZXh0U2libGluZztcblx0XHR9IHdoaWxlIChzaWJsaW5nICYmIHNpYmxpbmcubm9kZVR5cGUgIT09IDEpO1xuXHRcdHJldHVybiBzaWJsaW5nO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldEV2ZW50SG9zdChlKSB7XG5cdC8vIG9uIHRvdWNoZW5kIGV2ZW50LCB3ZSBoYXZlIHRvIHVzZSBgZS5jaGFuZ2VkVG91Y2hlc2Bcblx0Ly8gc2VlIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNzE5MjU2My90b3VjaGVuZC1ldmVudC1wcm9wZXJ0aWVzXG5cdC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vYmV2YWNxdWEvZHJhZ3VsYS9pc3N1ZXMvMzRcblx0aWYgKGUudGFyZ2V0VG91Y2hlcyAmJiBlLnRhcmdldFRvdWNoZXMubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIGUudGFyZ2V0VG91Y2hlc1swXTtcblx0fVxuXHRpZiAoZS5jaGFuZ2VkVG91Y2hlcyAmJiBlLmNoYW5nZWRUb3VjaGVzLmxlbmd0aCkge1xuXHRcdHJldHVybiBlLmNoYW5nZWRUb3VjaGVzWzBdO1xuXHR9XG5cdHJldHVybiBlO1xufVxuXG5mdW5jdGlvbiBnZXRDb29yZChjb29yZCwgZSkge1xuXHR2YXIgaG9zdCA9IGdldEV2ZW50SG9zdChlKTtcblx0dmFyIG1pc3NNYXAgPSB7XG5cdFx0cGFnZVg6ICdjbGllbnRYJywgLy8gSUU4XG5cdFx0cGFnZVk6ICdjbGllbnRZJyAvLyBJRThcblx0fTtcblx0aWYgKGNvb3JkIGluIG1pc3NNYXAgJiYgIShjb29yZCBpbiBob3N0KSAmJiBtaXNzTWFwW2Nvb3JkXSBpbiBob3N0KSB7XG5cdFx0Y29vcmQgPSBtaXNzTWFwW2Nvb3JkXTtcblx0fVxuXHRyZXR1cm4gaG9zdFtjb29yZF07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZHJhZ3VsYTtcbiIsIiEoZnVuY3Rpb24oKSB7XG5cbi8qKlxuICogV3JhcHMgZmFzdGRvbSBpbiBhIFByb21pc2UgQVBJXG4gKiBmb3IgaW1wcm92ZWQgY29udHJvbC1mbG93LlxuICpcbiAqIEBleGFtcGxlXG4gKlxuICogLy8gcmV0dXJuaW5nIGEgcmVzdWx0XG4gKiBmYXN0ZG9tLm1lYXN1cmUoKCkgPT4gZWwuY2xpZW50V2lkdGgpXG4gKiAgIC50aGVuKHJlc3VsdCA9PiAuLi4pO1xuICpcbiAqIC8vIHJldHVybmluZyBwcm9taXNlcyBmcm9tIHRhc2tzXG4gKiBmYXN0ZG9tLm1lYXN1cmUoKCkgPT4ge1xuICogICB2YXIgdyA9IGVsMS5jbGllbnRXaWR0aDtcbiAqICAgcmV0dXJuIGZhc3Rkb20ubXV0YXRlKCgpID0+IGVsMi5zdHlsZS53aWR0aCA9IHcgKyAncHgnKTtcbiAqIH0pLnRoZW4oKCkgPT4gY29uc29sZS5sb2coJ2FsbCBkb25lJykpO1xuICpcbiAqIC8vIGNsZWFyaW5nIHBlbmRpbmcgdGFza3NcbiAqIHZhciBwcm9taXNlID0gZmFzdGRvbS5tZWFzdXJlKC4uLilcbiAqIGZhc3Rkb20uY2xlYXIocHJvbWlzZSk7XG4gKlxuICogQHR5cGUge09iamVjdH1cbiAqL1xudmFyIGV4cG9ydHMgPSB7XG4gIGluaXRpYWxpemU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuX3Rhc2tzID0gbmV3IE1hcCgpO1xuICB9LFxuXG4gIG11dGF0ZTogZnVuY3Rpb24oZm4sIGN0eCkge1xuICAgIHJldHVybiBjcmVhdGUodGhpcywgJ211dGF0ZScsIGZuLCBjdHgpO1xuICB9LFxuXG4gIG1lYXN1cmU6IGZ1bmN0aW9uKGZuLCBjdHgpIHtcbiAgICByZXR1cm4gY3JlYXRlKHRoaXMsICdtZWFzdXJlJywgZm4sIGN0eCk7XG4gIH0sXG5cbiAgY2xlYXI6IGZ1bmN0aW9uKHByb21pc2UpIHtcbiAgICB2YXIgdGFza3MgPSB0aGlzLl90YXNrcztcbiAgICB2YXIgdGFzayA9IHRhc2tzLmdldChwcm9taXNlKTtcbiAgICB0aGlzLmZhc3Rkb20uY2xlYXIodGFzayk7XG4gICAgdGFza3MuZGVsZXRlKHRhc2spO1xuICB9XG59O1xuXG4vKipcbiAqIENyZWF0ZSBhIGZhc3Rkb20gdGFzayB3cmFwcGVkIGluXG4gKiBhICdjYW5jZWxsYWJsZScgUHJvbWlzZS5cbiAqXG4gKiBAcGFyYW0gIHtGYXN0RG9tfSAgZmFzdGRvbVxuICogQHBhcmFtICB7U3RyaW5nfSAgIHR5cGUgLSAnbWVhc3VyZSd8J211YXRhdGUnXG4gKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm5cbiAqIEByZXR1cm4ge1Byb21pc2V9XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZShwcm9taXNlZCwgdHlwZSwgZm4sIGN0eCkge1xuICB2YXIgdGFza3MgPSBwcm9taXNlZC5fdGFza3M7XG4gIHZhciBmYXN0ZG9tID0gcHJvbWlzZWQuZmFzdGRvbTtcbiAgdmFyIHRhc2s7XG5cbiAgdmFyIHByb21pc2UgPSBuZXcgUHJvbWlzZShmdW5jdGlvbihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0YXNrID0gZmFzdGRvbVt0eXBlXShmdW5jdGlvbigpIHtcbiAgICAgIHRhc2tzLmRlbGV0ZShwcm9taXNlKTtcbiAgICAgIHRyeSB7IHJlc29sdmUoY3R4ID8gZm4uY2FsbChjdHgpIDogZm4oKSk7IH1cbiAgICAgIGNhdGNoIChlKSB7IHJlamVjdChlKTsgfVxuICAgIH0sIGN0eCk7XG4gIH0pO1xuXG4gIHRhc2tzLnNldChwcm9taXNlLCB0YXNrKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbi8vIEV4cG9zZSB0byBDSlMsIEFNRCBvciBnbG9iYWxcbmlmICgodHlwZW9mIGRlZmluZSlbMF0gPT0gJ2YnKSBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBleHBvcnRzOyB9KTtcbmVsc2UgaWYgKCh0eXBlb2YgbW9kdWxlKVswXSA9PSAnbycpIG1vZHVsZS5leHBvcnRzID0gZXhwb3J0cztcbmVsc2Ugd2luZG93LmZhc3Rkb21Qcm9taXNlZCA9IGV4cG9ydHM7XG5cbn0pKCk7IiwiIShmdW5jdGlvbih3aW4pIHtcblxuLyoqXG4gKiBGYXN0RG9tXG4gKlxuICogRWxpbWluYXRlcyBsYXlvdXQgdGhyYXNoaW5nXG4gKiBieSBiYXRjaGluZyBET00gcmVhZC93cml0ZVxuICogaW50ZXJhY3Rpb25zLlxuICpcbiAqIEBhdXRob3IgV2lsc29uIFBhZ2UgPHdpbHNvbnBhZ2VAbWUuY29tPlxuICogQGF1dGhvciBLb3JuZWwgTGVzaW5za2kgPGtvcm5lbC5sZXNpbnNraUBmdC5jb20+XG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIE1pbmkgbG9nZ2VyXG4gKlxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbnZhciBkZWJ1ZyA9IDAgPyBjb25zb2xlLmxvZy5iaW5kKGNvbnNvbGUsICdbZmFzdGRvbV0nKSA6IGZ1bmN0aW9uKCkge307XG5cbi8qKlxuICogTm9ybWFsaXplZCByQUZcbiAqXG4gKiBAdHlwZSB7RnVuY3Rpb259XG4gKi9cbnZhciByYWYgPSB3aW4ucmVxdWVzdEFuaW1hdGlvbkZyYW1lXG4gIHx8IHdpbi53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbiAgfHwgd2luLm1velJlcXVlc3RBbmltYXRpb25GcmFtZVxuICB8fCB3aW4ubXNSZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbiAgfHwgZnVuY3Rpb24oY2IpIHsgcmV0dXJuIHNldFRpbWVvdXQoY2IsIDE2KTsgfTtcblxuLyoqXG4gKiBJbml0aWFsaXplIGEgYEZhc3REb21gLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBGYXN0RG9tKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYucmVhZHMgPSBbXTtcbiAgc2VsZi53cml0ZXMgPSBbXTtcbiAgc2VsZi5yYWYgPSByYWYuYmluZCh3aW4pOyAvLyB0ZXN0IGhvb2tcbiAgZGVidWcoJ2luaXRpYWxpemVkJywgc2VsZik7XG59XG5cbkZhc3REb20ucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogRmFzdERvbSxcblxuICAvKipcbiAgICogQWRkcyBhIGpvYiB0byB0aGUgcmVhZCBiYXRjaCBhbmRcbiAgICogc2NoZWR1bGVzIGEgbmV3IGZyYW1lIGlmIG5lZWQgYmUuXG4gICAqXG4gICAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmblxuICAgKiBAcHVibGljXG4gICAqL1xuICBtZWFzdXJlOiBmdW5jdGlvbihmbiwgY3R4KSB7XG4gICAgZGVidWcoJ21lYXN1cmUnKTtcbiAgICB2YXIgdGFzayA9ICFjdHggPyBmbiA6IGZuLmJpbmQoY3R4KTtcbiAgICB0aGlzLnJlYWRzLnB1c2godGFzayk7XG4gICAgc2NoZWR1bGVGbHVzaCh0aGlzKTtcbiAgICByZXR1cm4gdGFzaztcbiAgfSxcblxuICAvKipcbiAgICogQWRkcyBhIGpvYiB0byB0aGVcbiAgICogd3JpdGUgYmF0Y2ggYW5kIHNjaGVkdWxlc1xuICAgKiBhIG5ldyBmcmFtZSBpZiBuZWVkIGJlLlxuICAgKlxuICAgKiBAcGFyYW0gIHtGdW5jdGlvbn0gZm5cbiAgICogQHB1YmxpY1xuICAgKi9cbiAgbXV0YXRlOiBmdW5jdGlvbihmbiwgY3R4KSB7XG4gICAgZGVidWcoJ211dGF0ZScpO1xuICAgIHZhciB0YXNrID0gIWN0eCA/IGZuIDogZm4uYmluZChjdHgpO1xuICAgIHRoaXMud3JpdGVzLnB1c2godGFzayk7XG4gICAgc2NoZWR1bGVGbHVzaCh0aGlzKTtcbiAgICByZXR1cm4gdGFzaztcbiAgfSxcblxuICAvKipcbiAgICogQ2xlYXJzIGEgc2NoZWR1bGVkICdyZWFkJyBvciAnd3JpdGUnIHRhc2suXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSB0YXNrXG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IHN1Y2Nlc3NcbiAgICogQHB1YmxpY1xuICAgKi9cbiAgY2xlYXI6IGZ1bmN0aW9uKHRhc2spIHtcbiAgICBkZWJ1ZygnY2xlYXInLCB0YXNrKTtcbiAgICByZXR1cm4gcmVtb3ZlKHRoaXMucmVhZHMsIHRhc2spIHx8IHJlbW92ZSh0aGlzLndyaXRlcywgdGFzayk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEV4dGVuZCB0aGlzIEZhc3REb20gd2l0aCBzb21lXG4gICAqIGN1c3RvbSBmdW5jdGlvbmFsaXR5LlxuICAgKlxuICAgKiBCZWNhdXNlIGZhc3Rkb20gbXVzdCAqYWx3YXlzKiBiZSBhXG4gICAqIHNpbmdsZXRvbiwgd2UncmUgYWN0dWFsbHkgZXh0ZW5kaW5nXG4gICAqIHRoZSBmYXN0ZG9tIGluc3RhbmNlLiBUaGlzIG1lYW5zIHRhc2tzXG4gICAqIHNjaGVkdWxlZCBieSBhbiBleHRlbnNpb24gc3RpbGwgZW50ZXJcbiAgICogZmFzdGRvbSdzIGdsb2JhbCB0YXNrIHF1ZXVlLlxuICAgKlxuICAgKiBUaGUgJ3N1cGVyJyBpbnN0YW5jZSBjYW4gYmUgYWNjZXNzZWRcbiAgICogZnJvbSBgdGhpcy5mYXN0ZG9tYC5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICpcbiAgICogdmFyIG15RmFzdGRvbSA9IGZhc3Rkb20uZXh0ZW5kKHtcbiAgICogICBpbml0aWFsaXplOiBmdW5jdGlvbigpIHtcbiAgICogICAgIC8vIHJ1bnMgb24gY3JlYXRpb25cbiAgICogICB9LFxuICAgKlxuICAgKiAgIC8vIG92ZXJyaWRlIGEgbWV0aG9kXG4gICAqICAgbWVhc3VyZTogZnVuY3Rpb24oZm4pIHtcbiAgICogICAgIC8vIGRvIGV4dHJhIHN0dWZmIC4uLlxuICAgKlxuICAgKiAgICAgLy8gdGhlbiBjYWxsIHRoZSBvcmlnaW5hbFxuICAgKiAgICAgcmV0dXJuIHRoaXMuZmFzdGRvbS5tZWFzdXJlKGZuKTtcbiAgICogICB9LFxuICAgKlxuICAgKiAgIC4uLlxuICAgKiB9KTtcbiAgICpcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwcm9wcyAgcHJvcGVydGllcyB0byBtaXhpblxuICAgKiBAcmV0dXJuIHtGYXN0RG9tfVxuICAgKi9cbiAgZXh0ZW5kOiBmdW5jdGlvbihwcm9wcykge1xuICAgIGRlYnVnKCdleHRlbmQnLCBwcm9wcyk7XG4gICAgaWYgKHR5cGVvZiBwcm9wcyAhPSAnb2JqZWN0JykgdGhyb3cgbmV3IEVycm9yKCdleHBlY3RlZCBvYmplY3QnKTtcblxuICAgIHZhciBjaGlsZCA9IE9iamVjdC5jcmVhdGUodGhpcyk7XG4gICAgbWl4aW4oY2hpbGQsIHByb3BzKTtcbiAgICBjaGlsZC5mYXN0ZG9tID0gdGhpcztcblxuICAgIC8vIHJ1biBvcHRpb25hbCBjcmVhdGlvbiBob29rXG4gICAgaWYgKGNoaWxkLmluaXRpYWxpemUpIGNoaWxkLmluaXRpYWxpemUoKTtcblxuICAgIHJldHVybiBjaGlsZDtcbiAgfSxcblxuICAvLyBvdmVycmlkZSB0aGlzIHdpdGggYSBmdW5jdGlvblxuICAvLyB0byBwcmV2ZW50IEVycm9ycyBpbiBjb25zb2xlXG4gIC8vIHdoZW4gdGFza3MgdGhyb3dcbiAgY2F0Y2g6IG51bGxcbn07XG5cbi8qKlxuICogU2NoZWR1bGVzIGEgbmV3IHJlYWQvd3JpdGVcbiAqIGJhdGNoIGlmIG9uZSBpc24ndCBwZW5kaW5nLlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHNjaGVkdWxlRmx1c2goZmFzdGRvbSkge1xuICBpZiAoIWZhc3Rkb20uc2NoZWR1bGVkKSB7XG4gICAgZmFzdGRvbS5zY2hlZHVsZWQgPSB0cnVlO1xuICAgIGZhc3Rkb20ucmFmKGZsdXNoLmJpbmQobnVsbCwgZmFzdGRvbSkpO1xuICAgIGRlYnVnKCdmbHVzaCBzY2hlZHVsZWQnKTtcbiAgfVxufVxuXG4vKipcbiAqIFJ1bnMgcXVldWVkIGByZWFkYCBhbmQgYHdyaXRlYCB0YXNrcy5cbiAqXG4gKiBFcnJvcnMgYXJlIGNhdWdodCBhbmQgdGhyb3duIGJ5IGRlZmF1bHQuXG4gKiBJZiBhIGAuY2F0Y2hgIGZ1bmN0aW9uIGhhcyBiZWVuIGRlZmluZWRcbiAqIGl0IGlzIGNhbGxlZCBpbnN0ZWFkLlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGZsdXNoKGZhc3Rkb20pIHtcbiAgZGVidWcoJ2ZsdXNoJyk7XG5cbiAgdmFyIHdyaXRlcyA9IGZhc3Rkb20ud3JpdGVzO1xuICB2YXIgcmVhZHMgPSBmYXN0ZG9tLnJlYWRzO1xuICB2YXIgZXJyb3I7XG5cbiAgdHJ5IHtcbiAgICBkZWJ1ZygnZmx1c2hpbmcgcmVhZHMnLCByZWFkcy5sZW5ndGgpO1xuICAgIHJ1blRhc2tzKHJlYWRzKTtcbiAgICBkZWJ1ZygnZmx1c2hpbmcgd3JpdGVzJywgd3JpdGVzLmxlbmd0aCk7XG4gICAgcnVuVGFza3Mod3JpdGVzKTtcbiAgfSBjYXRjaCAoZSkgeyBlcnJvciA9IGU7IH1cblxuICBmYXN0ZG9tLnNjaGVkdWxlZCA9IGZhbHNlO1xuXG4gIC8vIElmIHRoZSBiYXRjaCBlcnJvcmVkIHdlIG1heSBzdGlsbCBoYXZlIHRhc2tzIHF1ZXVlZFxuICBpZiAocmVhZHMubGVuZ3RoIHx8IHdyaXRlcy5sZW5ndGgpIHNjaGVkdWxlRmx1c2goZmFzdGRvbSk7XG5cbiAgaWYgKGVycm9yKSB7XG4gICAgZGVidWcoJ3Rhc2sgZXJyb3JlZCcsIGVycm9yLm1lc3NhZ2UpO1xuICAgIGlmIChmYXN0ZG9tLmNhdGNoKSBmYXN0ZG9tLmNhdGNoKGVycm9yKTtcbiAgICBlbHNlIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogV2UgcnVuIHRoaXMgaW5zaWRlIGEgdHJ5IGNhdGNoXG4gKiBzbyB0aGF0IGlmIGFueSBqb2JzIGVycm9yLCB3ZVxuICogYXJlIGFibGUgdG8gcmVjb3ZlciBhbmQgY29udGludWVcbiAqIHRvIGZsdXNoIHRoZSBiYXRjaCB1bnRpbCBpdCdzIGVtcHR5LlxuICpcbiAqIEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIHJ1blRhc2tzKHRhc2tzKSB7XG4gIGRlYnVnKCdydW4gdGFza3MnKTtcbiAgdmFyIHRhc2s7IHdoaWxlICh0YXNrID0gdGFza3Muc2hpZnQoKSkgdGFzaygpO1xufVxuXG4vKipcbiAqIFJlbW92ZSBhbiBpdGVtIGZyb20gYW4gQXJyYXkuXG4gKlxuICogQHBhcmFtICB7QXJyYXl9IGFycmF5XG4gKiBAcGFyYW0gIHsqfSBpdGVtXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5mdW5jdGlvbiByZW1vdmUoYXJyYXksIGl0ZW0pIHtcbiAgdmFyIGluZGV4ID0gYXJyYXkuaW5kZXhPZihpdGVtKTtcbiAgcmV0dXJuICEhfmluZGV4ICYmICEhYXJyYXkuc3BsaWNlKGluZGV4LCAxKTtcbn1cblxuLyoqXG4gKiBNaXhpbiBvd24gcHJvcGVydGllcyBvZiBzb3VyY2VcbiAqIG9iamVjdCBpbnRvIHRoZSB0YXJnZXQuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSB0YXJnZXRcbiAqIEBwYXJhbSAge09iamVjdH0gc291cmNlXG4gKi9cbmZ1bmN0aW9uIG1peGluKHRhcmdldCwgc291cmNlKSB7XG4gIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHRhcmdldFtrZXldID0gc291cmNlW2tleV07XG4gIH1cbn1cblxuLy8gVGhlcmUgc2hvdWxkIG5ldmVyIGJlIG1vcmUgdGhhblxuLy8gb25lIGluc3RhbmNlIG9mIGBGYXN0RG9tYCBpbiBhbiBhcHBcbnZhciBleHBvcnRzID0gd2luLmZhc3Rkb20gPSAod2luLmZhc3Rkb20gfHwgbmV3IEZhc3REb20oKSk7IC8vIGpzaGludCBpZ25vcmU6bGluZVxuXG4vLyBFeHBvc2UgdG8gQ0pTICYgQU1EXG5pZiAoKHR5cGVvZiBkZWZpbmUpWzBdID09ICdmJykgZGVmaW5lKGZ1bmN0aW9uKCkgeyByZXR1cm4gZXhwb3J0czsgfSk7XG5lbHNlIGlmICgodHlwZW9mIG1vZHVsZSlbMF0gPT0gJ28nKSBtb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHM7XG5cbn0pKCB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXMpO1xuIiwidmFyIHNpID0gdHlwZW9mIHNldEltbWVkaWF0ZSA9PT0gJ2Z1bmN0aW9uJywgdGljaztcbmlmIChzaSkge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldEltbWVkaWF0ZShmbik7IH07XG59IGVsc2Uge1xuICB0aWNrID0gZnVuY3Rpb24gKGZuKSB7IHNldFRpbWVvdXQoZm4sIDApOyB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRpY2s7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXRvYSA9IHJlcXVpcmUoJ2F0b2EnKTtcbnZhciBldmVudHMgPSBbXG4gICdjYW5jZWwnLFxuICAnY2xvbmVkJyxcbiAgJ2RyYWcnLFxuICAnZHJhZ2VuZCcsXG4gICdkcm9wJyxcbiAgJ291dCcsXG4gICdvdmVyJyxcbiAgJ3JlbW92ZScsXG4gICdzaGFkb3cnLFxuICAnZHJvcC1tb2RlbCcsXG4gICdyZW1vdmUtbW9kZWwnXG5dO1xuXG5mdW5jdGlvbiByZXBsaWNhdGVFdmVudHMgKGFuZ3VsYXIsIGJhZywgc2NvcGUpIHtcbiAgZXZlbnRzLmZvckVhY2gocmVwbGljYXRvcik7XG5cbiAgZnVuY3Rpb24gcmVwbGljYXRvciAodHlwZSkge1xuICAgIGJhZy5kcmFrZS5vbih0eXBlLCByZXBsaWNhdGUpO1xuXG4gICAgZnVuY3Rpb24gcmVwbGljYXRlICgpIHtcbiAgICAgIHZhciBhcmdzID0gYXRvYShhcmd1bWVudHMpLm1hcChhbmd1bGFyaXplKTtcbiAgICAgIGFyZ3MudW5zaGlmdChiYWcubmFtZSArICcuJyArIHR5cGUpO1xuICAgICAgc2NvcGUuJGVtaXQuYXBwbHkoc2NvcGUsIGFyZ3MpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFuZ3VsYXJpemUgKHZhbHVlKSB7XG4gICAgaWYgKGFuZ3VsYXIuaXNFbGVtZW50KHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGFuZ3VsYXIuZWxlbWVudCh2YWx1ZSk7XG4gICAgfVxuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcGxpY2F0ZUV2ZW50cztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRyYWd1bGEgPSByZXF1aXJlKCdkcmFndWxhJyk7XG52YXIgZHJhZ3VsYUtleSA9ICckJGRyYWd1bGEnO1xudmFyIHJlcGxpY2F0ZUV2ZW50cyA9IHJlcXVpcmUoJy4vcmVwbGljYXRlLWV2ZW50cycpO1xuXG5mdW5jdGlvbiByZWdpc3RlciAoYW5ndWxhcikge1xuICByZXR1cm4gW2Z1bmN0aW9uIGRyYWd1bGFTZXJ2aWNlICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgYWRkOiBhZGQsXG4gICAgICBmaW5kOiBmaW5kLFxuICAgICAgb3B0aW9uczogc2V0T3B0aW9ucyxcbiAgICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgICBoYW5kbGVNb2RlbHM6IGhhbmRsZU1vZGVsc1xuICAgIH07XG4gICAgZnVuY3Rpb24gaGFuZGxlTW9kZWxzKHNjb3BlLCBkcmFrZSl7XG4gICAgICBpZihkcmFrZS5yZWdpc3RlcmVkKXsgLy8gZG8gbm90IHJlZ2lzdGVyIGV2ZW50cyB0d2ljZVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgZHJhZ0VsbTtcbiAgICAgIHZhciBkcmFnSW5kZXg7XG4gICAgICB2YXIgZHJvcEluZGV4O1xuICAgICAgdmFyIHNvdXJjZU1vZGVsO1xuICAgICAgZHJha2Uub24oJ3JlbW92ZScsZnVuY3Rpb24gcmVtb3ZlTW9kZWwgKGVsLCBzb3VyY2UpIHtcbiAgICAgICAgaWYgKCFkcmFrZS5tb2RlbHMpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgc291cmNlTW9kZWwgPSBkcmFrZS5tb2RlbHNbZHJha2UuY29udGFpbmVycy5pbmRleE9mKHNvdXJjZSldO1xuICAgICAgICBzY29wZS4kYXBwbHlBc3luYyhmdW5jdGlvbiBhcHBseVJlbW92ZSgpIHtcbiAgICAgICAgICBzb3VyY2VNb2RlbC5zcGxpY2UoZHJhZ0luZGV4LCAxKTtcbiAgICAgICAgICBkcmFrZS5lbWl0KCdyZW1vdmUtbW9kZWwnLCBlbCwgc291cmNlKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGRyYWtlLm9uKCdkcmFnJyxmdW5jdGlvbiBkcmFnTW9kZWwgKGVsLCBzb3VyY2UpIHtcbiAgICAgICAgZHJhZ0VsbSA9IGVsO1xuICAgICAgICBkcmFnSW5kZXggPSBkb21JbmRleE9mKGVsLCBzb3VyY2UpO1xuICAgICAgfSk7XG4gICAgICBkcmFrZS5vbignZHJvcCcsZnVuY3Rpb24gZHJvcE1vZGVsIChkcm9wRWxtLCB0YXJnZXQsIHNvdXJjZSkge1xuICAgICAgICBpZiAoIWRyYWtlLm1vZGVscykge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkcm9wSW5kZXggPSBkb21JbmRleE9mKGRyb3BFbG0sIHRhcmdldCk7XG4gICAgICAgIHNjb3BlLiRhcHBseUFzeW5jKGZ1bmN0aW9uIGFwcGx5RHJvcCgpIHtcbiAgICAgICAgICBzb3VyY2VNb2RlbCA9IGRyYWtlLm1vZGVsc1tkcmFrZS5jb250YWluZXJzLmluZGV4T2Yoc291cmNlKV07XG4gICAgICAgICAgaWYgKHRhcmdldCA9PT0gc291cmNlKSB7XG4gICAgICAgICAgICBzb3VyY2VNb2RlbC5zcGxpY2UoZHJvcEluZGV4LCAwLCBzb3VyY2VNb2RlbC5zcGxpY2UoZHJhZ0luZGV4LCAxKVswXSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBub3RDb3B5ID0gZHJhZ0VsbSA9PT0gZHJvcEVsbTtcbiAgICAgICAgICAgIHZhciB0YXJnZXRNb2RlbCA9IGRyYWtlLm1vZGVsc1tkcmFrZS5jb250YWluZXJzLmluZGV4T2YodGFyZ2V0KV07XG4gICAgICAgICAgICB2YXIgZHJvcEVsbU1vZGVsID0gbm90Q29weSA/IHNvdXJjZU1vZGVsW2RyYWdJbmRleF0gOiBhbmd1bGFyLmNvcHkoc291cmNlTW9kZWxbZHJhZ0luZGV4XSk7XG5cbiAgICAgICAgICAgIGlmIChub3RDb3B5KSB7XG4gICAgICAgICAgICAgIHNvdXJjZU1vZGVsLnNwbGljZShkcmFnSW5kZXgsIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFyZ2V0TW9kZWwuc3BsaWNlKGRyb3BJbmRleCwgMCwgZHJvcEVsbU1vZGVsKTtcbiAgICAgICAgICAgIHRhcmdldC5yZW1vdmVDaGlsZChkcm9wRWxtKTsgLy8gZWxlbWVudCBtdXN0IGJlIHJlbW92ZWQgZm9yIG5nUmVwZWF0IHRvIGFwcGx5IGNvcnJlY3RseVxuICAgICAgICAgIH1cbiAgICAgICAgICBkcmFrZS5lbWl0KCdkcm9wLW1vZGVsJywgZHJvcEVsbSwgdGFyZ2V0LCBzb3VyY2UpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgZHJha2UucmVnaXN0ZXJlZCA9IHRydWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldE9yQ3JlYXRlQ3R4IChzY29wZSkge1xuICAgICAgdmFyIGN0eCA9IHNjb3BlW2RyYWd1bGFLZXldO1xuICAgICAgaWYgKCFjdHgpIHtcbiAgICAgICAgY3R4ID0gc2NvcGVbZHJhZ3VsYUtleV0gPSB7XG4gICAgICAgICAgYmFnczogW11cbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBjdHg7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGRvbUluZGV4T2YoY2hpbGQsIHBhcmVudCkge1xuICAgICAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoYW5ndWxhci5lbGVtZW50KHBhcmVudCkuY2hpbGRyZW4oKSwgY2hpbGQpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBhZGQgKHNjb3BlLCBuYW1lLCBkcmFrZSkge1xuICAgICAgdmFyIGJhZyA9IGZpbmQoc2NvcGUsIG5hbWUpO1xuICAgICAgaWYgKGJhZykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JhZyBuYW1lZDogXCInICsgbmFtZSArICdcIiBhbHJlYWR5IGV4aXN0cyBpbiBzYW1lIGFuZ3VsYXIgc2NvcGUuJyk7XG4gICAgICB9XG4gICAgICB2YXIgY3R4ID0gZ2V0T3JDcmVhdGVDdHgoc2NvcGUpO1xuICAgICAgYmFnID0ge1xuICAgICAgICBuYW1lOiBuYW1lLFxuICAgICAgICBkcmFrZTogZHJha2VcbiAgICAgIH07XG4gICAgICBjdHguYmFncy5wdXNoKGJhZyk7XG4gICAgICByZXBsaWNhdGVFdmVudHMoYW5ndWxhciwgYmFnLCBzY29wZSk7XG4gICAgICBpZihkcmFrZS5tb2RlbHMpeyAvLyBtb2RlbHMgdG8gc3luYyB3aXRoIChtdXN0IGhhdmUgc2FtZSBzdHJ1Y3R1cmUgYXMgY29udGFpbmVycylcbiAgICAgICAgaGFuZGxlTW9kZWxzKHNjb3BlLCBkcmFrZSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYmFnO1xuICAgIH1cbiAgICBmdW5jdGlvbiBmaW5kIChzY29wZSwgbmFtZSkge1xuICAgICAgdmFyIGJhZ3MgPSBnZXRPckNyZWF0ZUN0eChzY29wZSkuYmFncztcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYmFncy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoYmFnc1tpXS5uYW1lID09PSBuYW1lKSB7XG4gICAgICAgICAgcmV0dXJuIGJhZ3NbaV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgZnVuY3Rpb24gZGVzdHJveSAoc2NvcGUsIG5hbWUpIHtcbiAgICAgIHZhciBiYWdzID0gZ2V0T3JDcmVhdGVDdHgoc2NvcGUpLmJhZ3M7XG4gICAgICB2YXIgYmFnID0gZmluZChzY29wZSwgbmFtZSk7XG5cblx0XHRcdGlmICghYmFnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuICAgICAgdmFyIGkgPSBiYWdzLmluZGV4T2YoYmFnKTtcbiAgICAgIGJhZ3Muc3BsaWNlKGksIDEpO1xuICAgICAgYmFnLmRyYWtlLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gc2V0T3B0aW9ucyAoc2NvcGUsIG5hbWUsIG9wdGlvbnMpIHtcbiAgICAgIHZhciBiYWcgPSBhZGQoc2NvcGUsIG5hbWUsIGRyYWd1bGEob3B0aW9ucykpO1xuICAgICAgaGFuZGxlTW9kZWxzKHNjb3BlLCBiYWcuZHJha2UpO1xuICAgIH1cbiAgfV07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmVnaXN0ZXI7XG4iXX0=
