import "./globals.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-mono/700.css";

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { defaultTheme, THEME_STORAGE_KEY } from "@/lib/themes";

export const metadata = {
  title: "Reverse Whistle",
  description: "Reverse Whistle football match analysis and incident review",
};

const themeBootScript = `(function(){var theme="${defaultTheme}";document.documentElement.dataset.theme=theme;try{localStorage.setItem("${THEME_STORAGE_KEY}",theme);}catch(e){}})();`;

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
