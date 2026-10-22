import "./globals.css";

export const metadata = {
  title: "Football",
  description: "Football hackathon site",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
