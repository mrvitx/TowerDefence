using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;

namespace KaffekattenTD.Wrapper
{
    public class MainForm : Form
    {
        private WebView2 webView;

        public MainForm()
        {
            Text = "Kaffekatten TD";
            Width = 1280;
            Height = 860;
            StartPosition = FormStartPosition.CenterScreen;

            webView = new WebView2
            {
                Dock = DockStyle.Fill
            };
            Controls.Add(webView);

            Shown += async (_, __) =>
            {
                try
                {
                    await webView.EnsureCoreWebView2Async();

                    // Resolve path to content folder (copied alongside the exe)
                    var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
                    var contentRoot = Path.Combine(exeDir, "Content");

                    // Prefer SPEL.HTML if present, otherwise START.html
                    string[] candidates = new[] { "SPEL.HTML", "START.html", "index.html", "START.HTML", "spel.html" };
                    string? entry = null;
                    foreach (var name in candidates)
                    {
                        var p = Path.Combine(contentRoot, name);
                        if (File.Exists(p)) { entry = p; break; }
                    }

                    if (entry == null)
                    {
                        MessageBox.Show("Kunde inte hitta SPEL.HTML eller START.html i Content/", "Fel", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        Close();
                        return;
                    }

                    var uri = new Uri(entry);
                    // Allow file access and local storage
                    var settings = webView.CoreWebView2.Settings;
                    settings.AreDefaultScriptDialogsEnabled = true;
                    settings.AreDefaultContextMenusEnabled = true;
                    settings.IsStatusBarEnabled = false;

                    // Navigate to local file
                    webView.CoreWebView2.Navigate(uri.AbsoluteUri);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("WebView2 startfel: " + ex.Message, "Fel", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    Close();
                }
            };
        }
    }
}
