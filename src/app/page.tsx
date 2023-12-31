"use client";
import Banner from "@/components/Banner";
import { Grid, Stack, Typography } from "@mui/material";
import ForwardIcon from "@mui/icons-material/Forward";
import GradientButton from "@/components/GradientButton";
import PostCard from "@/components/PostCard";
import { backend_api } from "@/utils/api";
import { fetchFanMeetings } from "@/hooks/useFanMeetings";
import { useQuery } from "@tanstack/react-query";
import ShowDialog from "@/components/ShowDialog";
import { fetchTodayFanmeeting } from "@/hooks/useTodayFanmeeting";
import Link from "next/link";
import data from "@/mock/fanMeeting.json";
import { useEffect, useState } from "react";

export default function Home() {
  // const { data } = useQuery({
  //   queryKey: ["fanMeetings", "opened"],
  //   queryFn: ({ queryKey }) => fetchFanMeetings(queryKey[1]),
  // });

  // const { data: todayMeeting } = useQuery({
  //   queryKey: ["fanMeetings", "today"],
  //   queryFn: () => fetchTodayFanmyeeting(),
  // });

  const [todayMeeting, setTodayMeeting] = useState<any>();

  useEffect(() => {
    fetchTodayFanmeeting().then((res) => {
      setTodayMeeting(res);
    });
  }, []);

  const moveWaitingRoom = (e) => {
    e.preventDefault();

    backend_api()
      .post(
        "/chat/room",
        { name },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
      .then((response) => {
        console.log(response);
        // setRoom(response.data);
      })
      .catch((error) => {
        console.error(error.message);
        // setError(error.message);
      });
  };

  return (
    <Grid
      container
      direction="row"
      alignItems="center"
      maxWidth="lg"
      spacing={2}
    >
      <Grid item xs={12} sx={{ marginTop: 1 }}>
        <Banner />
      </Grid>
      {todayMeeting !== null && todayMeeting?.data !== null && (
        <Grid
          item
          xs={12}
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginTop: 4,
          }}
        >
          <Link
            // href={`/waitingroom?id=${todayMeeting?.data?.id}`}
            href={`/waitingroom/${todayMeeting?.data?.id}`}
            style={{ width: "100%" }}
          >
            <Stack
              component="div"
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={2}
              sx={{
                backgroundImage: `url('/banner.jpeg')`,
                backgroundSize: "cover",
                width: "100%",
                height: "120px",
                borderRadius: "10px",
                position: "relative",
              }}
            >
              <Typography
                variant="h3"
                sx={{
                  color: "white",
                  fontWeight: 800,
                  position: "absolute",
                  textAlign: "center",
                  width: "100%",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                당신의 {todayMeeting?.data?.title ?? "팬미팅"} 놓치지 마세요!
                지금 바로 클릭하세요!
              </Typography>
            </Stack>
          </Link>
        </Grid>
      )}

      <Grid item xs={12}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
          sx={{ marginTop: 2 }}
        >
          <Typography variant="h3" sx={{ color: "#ed6ea0", fontWeight: 800 }}>
            OPEN
          </Typography>
          <Link href={"/fanmeeting-list"}>
            <GradientButton
              variant="contained"
              endIcon={<ForwardIcon />}
              sx={{ borderRadius: "10px" }}
            >
              전체보기
            </GradientButton>
          </Link>
        </Stack>
      </Grid>
      {data &&
        data?.map((meeting, i) => (
          <Grid key={i} item xs={3}>
            <PostCard fanMeeting={meeting} index={1} />
          </Grid>
        ))}
      <ShowDialog />
    </Grid>
  );
}
