using System;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace KaffekattenTD.Wrapper
{
    internal static class Program
    {
        [STAThread]
        static void Main()
        {
            ApplicationConfiguration.Initialize();
            Application.Run(new MainForm());
        }
    }
}
