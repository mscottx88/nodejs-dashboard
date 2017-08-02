"use strict";

var blessed = require("blessed");
var EventEmitter = require("events").EventEmitter;

var ERROR_TEXT_DISPLAY_TIME = 3000;
var DEFAULT_WIDTH = 64;
var DEFAULT_HEIGHT = 12;

/**
 * This is the constructor for the Base Input Dialog View.
 *
 * @param {Object} options
 * Options that may be specified.
 *
 * @returns {void}
 */
var BaseInputDialogView = function BaseInputDialogView(options) {
  /**
   * Create the elements that make up the view.
   *
   * @returns {void}
   */
  var createViewElements = function () {
    this.node = blessed.box({
      position: {
        top: "center",
        left: "center",
        // using fixed numbers to support use of alignment tags
        width: this.width,
        height: this.height
      },
      border: "line",
      padding: {
        left: 1,
        right: 1
      },
      style: {
        border: {
          fg: "white"
        }
      },
      tags: true,
      hidden: true,
      label: this.label
    });

    this.form = blessed.form({
      name: "form",
      top: 0,
      left: 0,
      height: "100%-2",
      width: "100%-4",
      keys: true
    });

    this.instructionsLabel = blessed.text({
      top: 1,
      align: "center",
      width: "100%",
      content: this.getInstructionsLabel()
    });

    this.textBox = blessed.textbox({
      name: "textBox",
      input: true,
      inputOnFocus: true,
      top: 3,
      left: 0,
      height: 1,
      width: "100%",
      style: {
        fg: "white",
        bg: "black",
        focus: {
          fg: "yellow"
        },
        underline: true
      },
      keys: true,
      content: ""
    });

    this.errorText = blessed.text({
      top: 5,
      align: "center",
      width: "100%",
      height: 1,
      content: "",
      style: {
        fg: "red"
      },
      hidden: true
    });

    this.acceptButton = blessed.button({
      top: "100%-3",
      height: 3,
      width: "half",
      name: "accept",
      content: "Accept",
      align: "center",
      style: {
        focus: {
          bg: "green",
          fg: "black"
        },
        border: {
          fg: "green"
        },
        fg: "green"
      },
      border: {
        type: "line"
      }
    });

    this.cancelButton = blessed.button({
      left: "50%",
      top: "100%-3",
      height: 3,
      width: "half",
      name: "cancel",
      content: "Cancel",
      align: "center",
      style: {
        focus: {
          bg: "red",
          fg: "black"
        },
        fg: "red",
        border: {
          fg: "red"
        }
      },
      border: {
        type: "line"
      }
    });
  }.bind(this);

  /**
   * Construct the view now that the elements have been created.
   *
   * @returns {void}
   */
  var constructView = function () {
    options.parent.append(this.node);

    this.node.append(this.form);
    this.form.append(this.instructionsLabel);
    this.form.append(this.textBox);
    this.form.append(this.errorText);
    this.form.append(this.acceptButton);
    this.form.append(this.cancelButton);
  }.bind(this);

  /**
   * Setup all event handlers for the screen to flow.
   *
   * @returns {void}
   */
  var setupEventHandlers = function () {
    this.node.on("show", function () {
      this.screen.saveFocus();
      this.node.setFront();
      this.form.reset();
      this.textBox.focus();
    }.bind(this));

    this.form.on("reset", function () {
      this.errorText.hide();
    }.bind(this));

    this.textBox.key("enter", function () {
      this.acceptButton.press();
    }.bind(this));

    this.textBox.key("escape", function () {
      this.cancelButton.press();
    }.bind(this));

    this.acceptButton.key("escape", function () {
      this.cancelButton.press();
    }.bind(this));

    this.acceptButton.on("press", function () {
      this.form.submit();
    }.bind(this));

    this.cancelButton.key("escape", function () {
      this.cancelButton.press();
    }.bind(this));

    this.cancelButton.on("press", function () {
      this.form.cancel();
    }.bind(this));

    this.form.on("submit", function (data) {
      if (this.errorTimeout) {
        clearTimeout(this.errorTimeout);
        delete this.errorTimeout;
      }

      try {
        this.validate(data);
        this.hide();
      } catch (e) {
        this.errorText.setContent(e.message);
        this.errorText.show();
        this.textBox.focus();
        this.screen.render();

        this.errorTimeout = setTimeout(function () {
          this.errorText.hide();
          this.screen.render();
        }.bind(this), ERROR_TEXT_DISPLAY_TIME);
      }
    }.bind(this));

    this.form.on("cancel", function () {
      this.hide();
    }.bind(this));
  }.bind(this);

  // super()
  EventEmitter.call(this);

  // capture options
  this.parent = options.parent;
  this.screen = options.screen || this.parent.screen;
  this.label = options.label || "";
  this.width = options.width || DEFAULT_WIDTH;
  this.height = options.height || DEFAULT_HEIGHT;

  // build the view
  createViewElements();
  constructView();
  setupEventHandlers();
};

// inheritance
BaseInputDialogView.prototype = Object.create(EventEmitter.prototype);

/**
 * Toggle the visibility of the view.
 *
 * @returns {void}
 */
BaseInputDialogView.prototype.toggle = function () {
  this.node.toggle();
};

/**
 * Hide the view.
 *
 * @returns {void}
 */
BaseInputDialogView.prototype.hide = function () {
  this.node.hide();
  this.screen.restoreFocus();
  this.screen.render();
};

/**
 * Check to see if the view is visible.
 *
 * @returns {Boolean}
 * Truthy if the view is visible, falsey otherwise.
 */
BaseInputDialogView.prototype.isVisible = function () {
  return this.node.visible;
};

/**
 * Get the instructions label for the view.
 *
 * @returns {Object}
 * The instructions label is returned.
 */
BaseInputDialogView.prototype.getInstructionsLabel = function () {
  return "";
};

/**
 * Validate the view input.
 *
 * @param {Object} data
 * The data that was validated.
 *
 * @throws {Error}
 * Will throw if there is an error.
 *
 * @returns {void}
 */
BaseInputDialogView.prototype.validate = function (data) {
  this.emit("validated", data);
};

module.exports = BaseInputDialogView;
