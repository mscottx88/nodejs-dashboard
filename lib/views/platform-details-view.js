"use strict";

var blessed = require("blessed");
var os = require("os");
var prettyBytes = require("pretty-bytes");
var _ = require("lodash");

var BaseView = require("./base-view");
var FilterEnvDialogView = require("./filter-env-dialog-view");

var localKeys = [
  "w", "S-w", "s", "S-s",
  "f", "S-f", "C-f",
  "pageup", "pagedown"
];

var BOX_PADDING = 2;

var PlatformDetailsView = function PlatformDetailsView(options) {
  BaseView.call(this, options);

  this.screen = options.parent.screen;
  this._remountOnResize = true;
  this.globalKeys = options.globalKeys || [];
  this.localKeys = localKeys;
  this.filterEnvDialogView = new FilterEnvDialogView(options);
  this._createViews(options);
};

PlatformDetailsView.prototype = Object.create(BaseView.prototype);

PlatformDetailsView.prototype.getDefaultLayoutConfig = function () {
  return {
    borderColor: "cyan",
    title: "memory"
  };
};

var getBoxContent = function (data) {
  var longestLabel = _.reduce(data, function (prev, detail) {
    return Math.max(prev, detail.label.length);
  }, 0);

  var getFormattedContent = function (prev, details) {
    prev += "{cyan-fg}{bold}"
      + details.label
      + _.repeat(" ", longestLabel - details.label.length)
      + "{/}{green-fg} "
      + details.data
      + "{/}\r";
    return prev;
  };

  return _.trimEnd(_.reduce(data, getFormattedContent, ""), "\r");
};

var getNodeDetails = function () {
  return [
    {
      label: "Version",
      data: process.version
    }, {
      label: "LTS",
      data: process.release.lts
    }, {
      label: "Uptime",
      data: process.uptime() + "s"
    }
  ];
};

var getSystemDetails = function () {
  return [
    {
      label: "Architecture",
      data: os.arch()
    }, {
      label: "Endianness",
      data: os.endianness() === "BE" ? "Big Endian" : "Little Endian"
    }, {
      label: "Host Name",
      data: os.hostname()
    }, {
      label: "Total Memory",
      data: prettyBytes(os.totalmem())
    }, {
      label: "Platform",
      data: os.platform()
    }, {
      label: "Release",
      data: os.release()
    }, {
      label: "Type",
      data: os.type()
    }
  ];
};

var getUserDetails = function () {
  var userInfo = os.userInfo({ encoding: "utf8" });

  return [
    {
      label: "User Name",
      data: userInfo.username
    }, {
      label: "Home",
      data: userInfo.homedir
    }, {
      label: "User ID",
      data: userInfo.uid
    }, {
      label: "Group ID",
      data: userInfo.gid
    }, {
      label: "Shell",
      data: userInfo.shell
    }
  ];
};

var getCpuDetails = function () {
  var cpuInfo = os.cpus();

  return _.map(cpuInfo, function (info, index) {
    return {
      label: "[" + index + "]",
      data: info.model + " " + info.speed
    };
  });
};

var getEnvDetails = function (filter) {
  // escape the RegExp
  var filterPattern = new RegExp((filter || "").replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$"), "i");

  return _.filter(_.map(process.env, function (value, key) {
    return {
      label: key,
      data: value
    };
  }), function (details) {
    if (!filter) {
      return true;
    }

    return filterPattern.test(details.label) || filterPattern.test(details.data);
  });
};

PlatformDetailsView.prototype._createViews = function (options) {
  var createViewElements = function () {
    var top = 0;

    this.node = blessed.box({
      label: this.layoutConfig.title,
      border: "line",
      style: {
        border: {
          fg: this.layoutConfig.borderColor
        }
      },
      scrollable: true,
      keys: true
    });

    // @todo make uptime update realtime
    var nodeDetailsData = getNodeDetails();
    this.nodeDetails = blessed.box({
      label: " Node ",
      border: "line",
      style: {
        border: {
          fg: "white"
        }
      },
      width: "33%",
      height: "shrink",
      tags: true,
      content: getBoxContent(nodeDetailsData),
      padding: {
        left: 1,
        right: 1
      },
      top: top
    });

    top += nodeDetailsData.length + BOX_PADDING;

    var systemDetailsData = getSystemDetails();
    this.systemDetails = blessed.box({
      label: " System ",
      border: "line",
      style: {
        border: {
          fg: "white"
        }
      },
      width: "33%",
      height: "shrink",
      tags: true,
      content: getBoxContent(systemDetailsData),
      padding: {
        left: 1,
        right: 1
      },
      top: top
    });

    top += systemDetailsData.length + BOX_PADDING;

    var userDetailsData = getUserDetails();
    this.userDetails = blessed.box({
      label: " User ",
      border: "line",
      style: {
        border: {
          fg: "white"
        }
      },
      width: "33%",
      height: "shrink",
      tags: true,
      content: getBoxContent(userDetailsData),
      padding: {
        left: 1,
        right: 1
      },
      top: top
    });

    top += userDetailsData.length + BOX_PADDING;

    var cpuDetailsData = getCpuDetails();
    this.cpuDetails = blessed.box({
      label: " CPU(s) ",
      border: "line",
      style: {
        border: {
          fg: "white"
        }
      },
      width: "33%",
      height: "shrink",
      tags: true,
      content: getBoxContent(cpuDetailsData),
      padding: {
        left: 1,
        right: 1
      },
      top: top
    });

    var envDetailsData = getEnvDetails();
    this.envDetails = blessed.box({
      label: " env ",
      border: "line",
      style: {
        border: {
          fg: "white"
        }
      },
      width: "66%",
      height: "shrink",
      tags: true,
      content: getBoxContent(envDetailsData),
      padding: {
        left: 1,
        right: 1
      },
      left: "33%",
      scrollable: true,
      scrollbar: {
        ch: " ",
        inverse: true,
        style: {
          bg: "green"
        }
      },
      keys: true,
      input: true
    });
  }.bind(this);

  var constructView = function () {
    this.screen.saveFocus();

    options.parent.append(this.node);

    this.node.append(this.nodeDetails);
    this.node.append(this.systemDetails);
    this.node.append(this.userDetails);
    this.node.append(this.cpuDetails);
    this.node.append(this.envDetails);

    this.envDetails.focus();

    this.recalculatePosition();
  }.bind(this);

  var setupEventHandlers = function () {
    var scrollDetails = function (ch, key) {
      var scroll;

      switch (key.full) {
      case "w":
      case "S-w":
        scroll = -1;
        break;
      case "s":
      case "S-s":
        scroll = +1;
        break;
      case "pageup":
        scroll = -this.envDetails.height;
        break;
      case "pagedown":
        scroll = +this.envDetails.height;
        break;
      }

      this.envDetails.scroll(scroll);
      this.screen.render();
    }.bind(this);

    var filterEnv = function () {
      this.filterEnvDialogView.toggle();
    }.bind(this);

    var filterEnvValidated = function (data) {
      var content = getBoxContent(getEnvDetails(data.textBox));
      if (!content) {
        content = "{red-fg}{bold}No env variables found matching filter criteria{/}";
      }

      if (data.textBox) {
        this.envDetails.setLabel(" env (subsetted) ");
      } else {
        this.envDetails.setLabel(" env ");
      }

      this.envDetails.resetScroll();
      this.envDetails.setContent(content);
    }.bind(this);

    this.envDetails.key(["w", "S-w", "s", "S-s", "pageup", "pagedown"], scrollDetails);
    this.envDetails.key(["f", "S-f", "C-f"], filterEnv);

    this.filterEnvDialogView.on("validated", filterEnvValidated);

    this.envDetails.on("detach", function () {
      this.envDetails.unkey(["w", "S-w", "s", "S-s", "pageup", "pagedown", "f", "S-f", "C-f"], scrollDetails);
      this.filterEnvDialogView.removeAllListeners("validated");
    }.bind(this));

    this.listenGlobalKeys([this.envDetails]);
  }.bind(this);

  createViewElements();
  constructView();
  setupEventHandlers();
};

PlatformDetailsView.prototype.destroy = function () {
  BaseView.prototype.destroy.call(this);
};

module.exports = PlatformDetailsView;
