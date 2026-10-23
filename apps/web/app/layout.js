import "./globals.css";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { defaultTheme } from "@/lib/themes";

export const metadata = {
  title: "Football Interpreter",
  description: "Football decision interpreter with match overview and 3D incident review",
};

const themeBootScript = `(function(){try{var k="football-theme";var t=localStorage.getItem(k);var d="${defaultTheme}";if(!t)t=d;document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme="${defaultTheme}";}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
