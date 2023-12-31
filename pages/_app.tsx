import React from "react";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import axios from "axios";
import AuthContext from "@/components/AuthContext";
import Header from "@/components/Header";
import { Grid } from "@mui/material";
import CustomThemeProvider from "@/components/ThemeProvider";

const defaultQueryFn = async ({ queryKey }) => {
  const { data } = await axios.get(
    `https://jsonplaceholder.typicode.com${queryKey[0]}`,
  );
  return data;
};

export default function MyApp({ Component, pageProps }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryFn: defaultQueryFn,
          },
        },
      }),
  );

  // provide the default query function to your app with defaultOptions
  return (
    <AuthContext>
      <CustomThemeProvider>
        <QueryClientProvider client={queryClient}>
          <HydrationBoundary state={pageProps.dehydratedState}>
            <Header />
            <Grid
              container
              direction="row"
              justifyContent="center"
              alignItems="center"
              maxWidth="xl"
              sx={{
                mx: "auto",
                backgroundColor: "#F8F8F8",
                paddingTop: 10,
                minHeight: "98vh",
              }}
            >
              <Component {...pageProps} />
            </Grid>
          </HydrationBoundary>
          <ReactQueryDevtools initialIsOpen={true} />
        </QueryClientProvider>
      </CustomThemeProvider>
    </AuthContext>
  );
}
