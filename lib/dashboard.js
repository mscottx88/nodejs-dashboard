"use strict";

var _ = require("lodash");
var blessed = require("blessed");

var StreamView = require("./views/stream-view");
var EventLoopView = require("./views/eventloop-view");
var MemoryGaugeView = require("./views/memory-gauge-view");
var MemoryGraphView = require("./views/memory-graph-view");
var CpuView = require("./views/cpu-view");
var HelpView = require("./views/help");
var generateLayouts = require("./generate-layouts");
var LogProvider = require("./providers/log-provider");
var MetricsProvider = require("./providers/metrics-provider");
var BaseView = require("./views/base-view");
var GotoTimeView = require("./views/goto-time-view");
var PlatformDetailsView = require("./views/platform-details-view");

var THROTTLE_TIMEOUT = 150;

var globalKeys = [
  "left", "right",
  "?", "h", "S-h",
  "g", "S-g",
  "w", "S-w", "s", "S-s",
  "a", "S-a", "d", "S-d",
  "z", "S-z", "x", "S-x",
  "q", "S-q",
  "escape"
];

var Dashboard = function Dashboard(options) {
  this.options = options || {};
  this.views = {};
  this.settings = options.settings;

  this.screen = blessed.screen({
    smartCSR: true,
    title: options.appName
  });

  this.logProvider = new LogProvider(this.screen);
  this.metricsProvider = new MetricsProvider(this.screen);

  this._createViews();
  this._configureKeys();
  this.screen.render();
};

Dashboard.prototype._createViews = function () {
  this.layouts = generateLayouts(this.options.layoutsFile);
  this.views = [];

  // container prevents stream view scrolling from interfering with side views
  this.container = blessed.box();
  this.screen.append(this.container);

  this.helpView = new HelpView({
    parent: this.container
  });

  this.gotoTimeView = new GotoTimeView({
    metricsProvider: this.metricsProvider,
    parent: this.container,
    screen: this.screen
  });

  this._showLayout(0);
};

Dashboard.prototype._configureKeys = function () {
  var rollLayout = _.throttle(function (ch, key) {
    var delta = key.name === "left" ? -1 : 1;
    var target = (this.currentLayout + delta + this.layouts.length) % this.layouts.length;
    this._showLayout(target);
  }.bind(this), THROTTLE_TIMEOUT);

  var toggleHelp = function () {
    this.helpView.node.toggle();
    this.screen.render();
  }.bind(this);

  var toggleGotoTime = function () {
    this.helpView.node.hide();
    this.gotoTimeView.toggle();
    this.screen.render();
  }.bind(this);

  var zoomGraphs = function (ch, key) {
    var zoom = key.name === "s" ? -1 : 1;
    this.screen.emit("zoomGraphs", zoom);
    this.screen.render();
  }.bind(this);

  var scrollGraphs = function (ch, key) {
    var scroll = key.name === "a" ? -1 : 1;
    this.screen.emit("scrollGraphs", scroll);
    this.screen.render();
  }.bind(this);

  var startGraphs = function (ch, key) {
    var goto = key.name === "z" ? -1 : 1;
    this.screen.emit("startGraphs", goto);
    this.screen.render();
  }.bind(this);

  var exit = function () {
    process.exit(0); // eslint-disable-line no-process-exit
  };

  var resetDisplay = function () {
    if (this.helpView.node.visible || this.gotoTimeView.isVisible()) {
      this.helpView.node.hide();
      this.gotoTimeView.hide();
      this.screen.render();
    } else {
      this.screen.emit("resetGraphs");
      this._showLayout(0);
    }
  }.bind(this);

  // this block redirects to the correct key handler and acts like
  // a global key processor for other screens
  // eslint-disable-next-line complexity
  this.screen.on("key", function (ch, key) {
    switch (key.full) {
    case "left":
    case "right":
      rollLayout(ch, key);
      break;
    case "?":
    case "h":
    case "S-h":
      toggleHelp(ch, key);
      break;
    case "g":
    case "S-g":
      toggleGotoTime(ch, key);
      break;
    case "w":
    case "S-w":
    case "s":
    case "S-s":
      zoomGraphs(ch, key);
      break;
    case "a":
    case "S-a":
    case "d":
    case "S-d":
      scrollGraphs(ch, key);
      break;
    case "z":
    case "S-z":
    case "x":
    case "S-x":
      startGraphs(ch, key);
      break;
    case "q":
    case "S-q":
      exit(ch, key);
      break;
    case "escape":
      resetDisplay(ch, key);
      break;
    }
  });

  // ignore locked works like a global key handler regardless of input
  // this key will be watched on the global screen
  this.screen.ignoreLocked = ["C-c"];
  this.screen.key("C-c", exit);

  this.container.key(globalKeys, function (ch, key) {
    this.screen.emit("key", ch, key);
  }.bind(this));
};

Dashboard.prototype.onEvent = function (event) {
  this.screen.emit(event.type, event.data);
  // avoid double screen render for stream events (Element calls screen.render on scroll)
  // TODO dashboard shouldn't know which events are used by which widgets
  if (event.type === "metrics") {
    this.screen.render();
  }
};

var VIEW_MAP = {
  log: StreamView,
  cpu: CpuView,
  memory: MemoryGaugeView,
  memoryGraph: MemoryGraphView,
  eventLoop: EventLoopView,
  platformDetails: PlatformDetailsView
};

Dashboard.prototype._showLayout = function (id) {
  if (this.currentLayout === id) {
    return;
  }
  _.each(this.views, function (view) {
    view.destroy();
  });

  this.views = [];

  // clear the focus state
  while (this.screen.focusPop()) {
    // no action necessary
  }

  // focus on the main container
  this.screen.focusPush(this.container);

  _.each(this.layouts[id], function (layoutConfig) {
    var View;

    if (VIEW_MAP[layoutConfig.view.type]) {
      View = VIEW_MAP[layoutConfig.view.type];
    } else if (layoutConfig.view.module) {
      // eslint-disable-next-line global-require
      View = require(layoutConfig.view.module)(BaseView);
    }

    if (View) {
      if (this.settings[layoutConfig.view.type]) {
        layoutConfig = _.merge(layoutConfig, {
          view: this.settings[layoutConfig.view.type]
        });
      }
      var view = new View({
        parent: this.container,
        logProvider: this.logProvider,
        metricsProvider: this.metricsProvider,
        layoutConfig: layoutConfig,
        globalKeys: globalKeys
      });

      this.views.push(view);
    }
  }.bind(this));

  this.currentLayout = id;
  this.helpView.node.setFront();
  this.screen.render();
};

module.exports = Dashboard;
