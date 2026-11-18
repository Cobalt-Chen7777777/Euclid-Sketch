function createPanelAddon(addonid, mainPath) {
  return JSB.defineClass(
    "MNPanelAddon : JSExtension",
    {
      sceneWillConnect: function () {
        self.addonid = addonid;
        self.mainPath = mainPath;
        self.panel = null;
      },

      sceneDidDisconnect: function () {
        if (self.panel) {
          self.panel.teardown();
          self.panel = null;
        }
      },

      notebookWillOpen: function () {
        self.openPanel();
      },

      controllerWillLayoutSubviews: function (controller) {
        if (controller === Application.sharedInstance().studyController(self.window)) {
          self.layout();
        }
      },

      /** 以指定形态显示浮层：mini = 贴在画布上的小浮条 */
      showFloating: function (mode) {
        if (!self.panel) return false;
        var controller = Application.sharedInstance().studyController(self.window);
        try {
          self.panel.showFloatingInMode(controller, mode === "workspace" ? "workspace" : "mini");
          return true;
        } catch (e) {
          // 旧版本没有 showFloatingInMode：退回普通浮层
          try {
            self.panel.showFloatingIn(controller);
            return true;
          } catch (e2) {
            return false;
          }
        }
      },

      openPanel: function (mode) {
        if (!self.panel) {
          self.panel = AddonWebPanel.panel();
          if (!self.panel) {
            throw new Error(
              "无法创建面板：当前不在沉浸模式，或模板 plugins 名单没有 " + self.addonid,
            );
          }
          self.panel.panelWidth = 420;
          self.panel.maxContentHeight = 680;
          self.panel.onMessage = function (name, payload) {
            if (name === "ping") {
              return { ok: true, payload: payload ?? null };
            }
            if (name === "expand") {
              return { ok: self.showFloating("workspace") };
            }
            if (name === "collapse") {
              return { ok: self.showFloating("mini") };
            }
            if (name === "closePanel") {
              self.panel.hideFloating();
              self.panel = null;
              self.refreshCommands();
              return { ok: true };
            }
            if (name === "__closed__") {
              self.panel = null;
              self.refreshCommands();
              return {};
            }
            throw new Error(`未知的面板命令：${name}`);
          };
          if (!self.panel.loadPanel()) {
            throw new Error(`无法加载面板：${self.mainPath}/index.html`);
          }
        }

        self.showFloating(mode || "mini");
      },

      layout: function () {
        if (!self.panel) return;
        self.showFloating("mini");
      },

      queryAddonCommandStatus: function () {
        return {
          image: "icon.png",
          object: self,
          selector: "togglePanel:",
          checked: Boolean(self.panel && self.panel.floatingVisible),
        };
      },

      togglePanel: function () {
        if (self.panel && self.panel.floatingVisible) {
          self.panel.hideFloating();
          self.panel = null;
          self.refreshCommands();
          return;
        }
        self.openPanel();
        self.refreshCommands();
      },

      refreshCommands: function () {
        var controller = Application.sharedInstance().studyController(self.window);
        if (controller) {
          controller.refreshAddonCommands();
        }
      },
    },
  );
}
