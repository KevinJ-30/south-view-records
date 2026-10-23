import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, Link, RouterProvider } from "react-router";
import { Layout } from "@/components/layout";
import { usePageTitle } from "@/hooks/use-page-title";
import { Toaster } from "@/components/ui/toast";
import { LandingPage } from "@/routes";
import { HomePage } from "@/routes/home";
import { RecordPage } from "@/routes/record";
import { SearchPage } from "@/routes/search";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "search", element: <SearchPage /> },
      { path: "records/:id", element: <RecordPage /> },
      // Ledger page OCR demo; not linked from the records index.
      { path: "ocr", element: <LandingPage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="flex flex-col gap-3">
      <h1 tabIndex={-1} className="font-heading text-3xl font-semibold text-primary outline-none">
        Page not found
      </h1>
      <p>
        <Link to="/" className="font-medium text-primary underline underline-offset-4">
          Go to the search page
        </Link>
      </p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
