"use strict";

var blessed = require("blessed");
var os = require("os");
var prettyBytes = require("pretty-bytes");
var utils = require("../utils");
var _ = require("lodash");

var BaseView = require("./base-view");
var FilterEnvDialogView = require("./filter-env-dialog-view");

var MILLISECONDS_PER_SECOND = require("../constants").MILLISECONDS_PER_SECOND;

var localKeys = [
  "w", "S-w", "s", "S-s",
  "f", "S-f", "C-f",
  "pageup", "pagedown"
];

var UPTIME_INTERVAL_MS = MILLISECONDS_PER_SECOND;
var BOX_PADDING = 2;

var NODE_DETAILS_BOX = {
  label: " Node ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var SYSTEM_DETAILS_BOX = {
  label: " System ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var USER_DETAILS_BOX = {
  label: " User ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  left: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var CPU_DETAILS_BOX = {
  label: " CPU(s) ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  width: "50%-1",
  left: "50%-1",
  height: "shrink",
  tags: true,
  padding: {
    left: 1,
    right: 1
  }
};

var ENV_DETAILS_BOX = {
  label: " Environment Variables ",
  border: "line",
  style: {
    border: {
      fg: "white"
    }
  },
  tags: true,
  padding: {
    left: 1,
    right: 1
  },
  scrollable: true,
  scrollbar: {
    style: {
      fg: "white",
      inverse: true
    },
    track: {
      ch: ":",
      fg: "cyan"
    }
  },
  keys: true,
  input: true
};

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

var getBoxContent = function (data, filters) {
  var longestLabel = _.reduce(data, function (prev, detail) {
    return Math.max(prev, detail.label.length);
  }, 0);

  var applyHighlights = function (value, normalAttributes) {
    var pattern;
    var split;

    if (!filters) {
      return normalAttributes + value;
    }

    pattern = _
      .chain(filters)
      .filter(function (filter) {
        return /\S/.test(filter);
      })
      .reduce(function (prev, filter) {
        if (prev !== "") {
          prev += "|";
        }
        prev += _.escapeRegExp(filter);
        return prev;
      }, "")
      .value();

    pattern = new RegExp(pattern, "gi");
    split = value.split(pattern);

    return normalAttributes
      + _.reduce(split, function (prev, curr) {
        var original = pattern.exec(value);
        return prev + "{inverse}" + original[0] + "{/}" + normalAttributes + curr;
      });
  };

  var getFormattedContent = function (prev, details) {
    prev += applyHighlights(details.label, "{cyan-fg}{bold}")
      + "{/}"
      + _.repeat(" ", longestLabel - details.label.length + 1)
      + applyHighlights(details.data, "{green-fg}")
      + "\n";
    return prev;
  };

  return _.trimEnd(_.reduce(data, getFormattedContent, ""), "\n");
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
      data: utils.getTimeIndexLabel(
        utils.convertElapsedTimeToTimeIndex(
          process.uptime() * MILLISECONDS_PER_SECOND))
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

var getEnvDetails = function (filters) {
  return _.filter(_.map(process.env, function (value, key) {
    return {
      label: key,
      data: value
    };
  }), function (details) {
    return _.every(filters || [], function (filter) {
      var pattern;

      if (!filter) {
        return true;
      }

      pattern = new RegExp(_.escapeRegExp(filter || ""), "i");
      return !filter || pattern.test(details.label) || pattern.test(details.data);
    });
  });
};

PlatformDetailsView.prototype._createViews = function (options) {
  var createViewElements = function () {
    var top = 0;
    var maxTop = 0;

    var createBox = function (contentProvider, box, varyHeight) {
      var detailData = contentProvider();
      box.content = getBoxContent(detailData);

      box.top = top;
      box.parent = this.node;

      if (!varyHeight) {
        box.height = detailData.length + BOX_PADDING;
      }

      top += detailData.length + BOX_PADDING;

      return blessed.box(box);
    }.bind(this);

    var alignBottom = function (box, y) {
      if (box.position.top + box.position.height !== y) {
        box.height = y - box.position.top;
      }
    };

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

    this.nodeDetails = createBox(getNodeDetails, NODE_DETAILS_BOX);
    this.systemDetails = createBox(getSystemDetails, SYSTEM_DETAILS_BOX);
    maxTop = top;

    top = 0;
    this.userDetails = createBox(getUserDetails, USER_DETAILS_BOX);
    this.cpuDetails = createBox(getCpuDetails, CPU_DETAILS_BOX);

    top = Math.max(maxTop, top);

    alignBottom(this.systemDetails, top);
    alignBottom(this.cpuDetails, top);

    this.envDetails = createBox(getEnvDetails, ENV_DETAILS_BOX, true);
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

    var displayFilterEnvWindow = function () {
      this.filterEnvDialogView.toggle();
      this.filterEnvDialogView.setValue(this._filter);
    }.bind(this);

    var filterEnvValidated = function (text) {
      this.setFilter(text);
    }.bind(this);

    var filterEnvChanged = function (ch, key, text) {
      this.setFilter(text);
    }.bind(this);

    this.envDetails.key(["w", "S-w", "s", "S-s", "pageup", "pagedown"], scrollDetails);
    this.envDetails.key(["f", "S-f", "C-f"], displayFilterEnvWindow);

    this.filterEnvDialogView.on("validated", filterEnvValidated);
    this.filterEnvDialogView.on("textChanged", filterEnvChanged);

    this.envDetails.on("detach", function () {
      // stop listening to keys
      this.envDetails.unkey(
        ["w", "S-w", "s", "S-s", "pageup", "pagedown", "f", "S-f", "C-f"],
        scrollDetails
      );

      // and events
      this.filterEnvDialogView.removeAllListeners("validated");
      this.filterEnvDialogView.removeAllListeners("textChanged");
    }.bind(this));

    this.uptimeInterval = setInterval(function () {
      this.nodeDetails.setContent(getBoxContent(getNodeDetails()));
      this.screen.render();
    }.bind(this), UPTIME_INTERVAL_MS);

    this.nodeDetails.on("detach", function () {
      if (this.uptimeInterval) {
        clearInterval(this.uptimeInterval);
        delete this.uptimeInterval;
      }
    }.bind(this));

    this.listenGlobalKeys([this.envDetails]);
  }.bind(this);

  this._filter = "";

  createViewElements();
  constructView();
  setupEventHandlers();
};

PlatformDetailsView.prototype.destroy = function () {
  BaseView.prototype.destroy.call(this);
};

PlatformDetailsView.prototype.setFilter = function (value) {
  if (value !== this._filter) {
    this.onFilterChange(this._filter, value);
    this._filter = value;
  }
};

PlatformDetailsView.prototype.onFilterChange = function (before, after) {
  var filters = after.split(/\s/g) || [after];
  var content = getBoxContent(getEnvDetails(filters), filters);

  if (!content) {
    content = "{red-fg}{bold}No env variables found matching filter criteria{/}";
  }

  // without removeLabel(), setLabel() messes up the border before the label
  this.envDetails.removeLabel();
  if (after) {
    this.envDetails.setLabel(" Environment Variables (subsetted) ");
  } else {
    this.envDetails.setLabel(" Environment Variables ");
  }

  this.envDetails.resetScroll();
  this.envDetails.setContent(content);
};

module.exports = PlatformDetailsView;
