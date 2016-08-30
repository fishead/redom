(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.redom = global.redom || {})));
}(this, (function (exports) { 'use strict';

var cached = {};
var cachedSVG = {};

var createSVG = document.createElementNS.bind(document, 'http://www.w3.org/2000/svg');

function el (query, a, b, c) {
  if (typeof query === 'function') {
    var len = arguments.length - 1;

    switch (len) {
      case 0: return query();
      case 1: return query(a);
      case 2: return query(a, b);
      case 3: return query(a, b, c);
    }

    var args = new Array(len);
    var i = 0;
    while (i < len) {
      args[i] = arguments[++i];
    }

    return query.apply(this, args);
  }

  var element = createElement(query);
  var empty = true;

  for (var i = 1; i < arguments.length; i++) {
    var arg = arguments[i];

    if (arg == null) continue;

    if (typeof arg === 'function') {
      arg = arg(element);
    }

    if (empty && (typeof arg === 'string' || typeof arg === 'number')) {
      element.textContent = arg;
      empty = false;
      continue;
    }

    if (mount(element, arg)) {
      empty = false;
      continue;
    }

    if (typeof arg === 'object') {
      for (var attr in arg) {
        var value = arg[attr];

        if (attr === 'style') {
          if (typeof value === 'string') {
            element.setAttribute(attr, value);
          } else {
            var elementStyle = element.style;

            for (var key in value) {
              elementStyle[key] = value[key];
            }
          }
        } else if (attr in element) {
          element[attr] = arg[attr];
        } else {
          element.setAttribute(attr, arg[attr]);
        }
      }
    }
  }

  return element;
}

el.extend = function (query) {
  return el.bind(this, query);
}

function createElement (query, svg) {
  var cache = svg ? cachedSVG : cached;

  if (query in cached) return cache[query].cloneNode(false);

  // query parsing magic by https://github.com/maciejhirsz

  var tag, id, className;

  var mode = 0;
  var from = 0;

  for (var i = 0, len = query.length; i <= len; i++) {
    var cp = i === len ? 0 : query.charCodeAt(i);

    //  cp === '#'     cp === '.'     nullterm
    if (cp === 0x23 || cp === 0x2E || cp === 0) {
      if (mode === 0) {
        tag = i  === 0 ? 'div'
            : cp === 0 ? query
            :            query.substring(from, i);
      } else {
        var slice = query.substring(from, i)
        if (mode === 1) {
          id = slice;
        } else if (className) {
          className += ' ' + slice;
        } else {
          className = slice;
        }
      }

      from = i + 1;
      mode = cp === 0x23 ? 1 : 2;
    }
  }

  var el = svg ? createSVG(tag) : document.createElement(tag);

  id && (el.id = id);
  className && (el.className = className);

  cache[query] = el;

  return el.cloneNode(false);
}

var text = document.createTextNode.bind(document);

function doMount (parent, child, before) {
  if (before) {
    parent.insertBefore(child, before.el || before);
  } else {
    parent.appendChild(child);
  }
}

function mount$1 (parent, child, before) {
  var parentEl = parent.el || parent;
  var childEl = child.el || child;
  var type = child && child.constructor;

  if (type === String || type === Number) {
    doMount(parentEl, text(child), before);
    return true;
  } else if (type === Array) {
    for (var i = 0; i < child.length; i++) {
      mount$1(parentEl, child[i], before);
    }
    return true;
  } else if (childEl.nodeType) {
    if (child !== childEl) {
      childEl.view = child;
    }
    if (childEl.mounted) {
      childEl.mounted = false;
      child.unmount && child.unmount();
      notifyUnmountDown(childEl);
    }
    doMount(parentEl, childEl, before);
    if (parentEl.mounted || document.contains(childEl)) {
      childEl.mounted = true;
      child.mount && child.mount();
      notifyMountDown(childEl);
    }
    return true;
  }
  return false;
}

function unmount (parent, child) {
  var parentEl = parent.el || parent;
  var childEl = child.el || child;

  parentEl.removeChild(childEl);

  childEl.mounted = false;
  childEl.unmount && childEl.unmount();
  notifyUnmountDown(childEl);
}

function notifyMountDown (child) {
  var traverse = child.firstChild;

  while (traverse) {
    if (traverse.mounted) {
      return;
    }
    traverse.mounted = true;
    traverse.view && traverse.view.mount && traverse.view.mount();
    notifyMountDown(traverse);
    traverse = traverse.nextSibling;
  }
}

function notifyUnmountDown (child) {
  var traverse = child.firstChild;

  while (traverse) {
    if (!traverse.mounted) {
      return;
    }
    traverse.mounted = false;
    traverse.view && traverse.view.unmount && traverse.view.unmount();
    notifyUnmountDown(traverse);
    traverse = traverse.nextSibling;
  }
}

var clones = {};

function svg (query) {
  var clone = clones[query] || (clones[query] = createElement(query, true));
  var element = clone.cloneNode(false);
  var empty = true;

  for (var i = 1; i < arguments.length; i++) {
    var arg = arguments[i];

    if (arg == null) continue;

    if (typeof arg === 'function') {
      arg = arg(element);
    }

    var type = arg.constructor;

    if (empty && (arg === String || arg === Number)) {
      element.textContent = arg;
      empty = false;
      continue;
    }

    if (mount(element, arg)) {
      empty = false;
      continue;
    }

    for (var attr in arg) {
      if (attr === 'style') {
        var elementStyle = element.style;
        var style = arg.style;
        if (style.constructor !== String) {
          for (var key in style) {
            elementStyle[key] = style[key];
          }
        } else {
          element.setAttribute(attr, arg[attr]);
        }
      } else {
        element.setAttribute(attr, arg[attr]);
      }
    }
  }

  return element;
}

svg.extend = function (query) {
  return svg.bind(this, query);
}

function view (proto) {
  return function (a, b, c) {
    var view = Object.create(proto);

    var len = arguments.length;

    switch (len) {
      case 0:
        proto.init.call(view);
        return view;
      case 1:
        proto.init.call(view, a);
        return view;
      case 2:
        proto.init.call(view, a, b);
        return view;
      case 3:
        proto.init.call(view, a, b, c);
        return view;
    }

    var args = new Array(len);
    var i = 0;
    while (i < len) {
      args[i] = arguments[++i];
    }

    proto.init.apply(view, args);

    return view;
  }
}

exports.el = el;
exports.createElement = createElement;
exports.mount = mount$1;
exports.unmount = unmount;
exports.text = text;
exports.svg = svg;
exports.view = view;

Object.defineProperty(exports, '__esModule', { value: true });

})));