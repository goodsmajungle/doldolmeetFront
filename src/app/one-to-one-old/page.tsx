"use client";
import {
  Connection,
  OpenVidu,
  Publisher,
  Session,
  StreamManager,
} from "openvidu-browser";
import { Grid, Stack } from "@mui/material";
import React, { useEffect, useRef, useState } from "react";
import Typography from "@mui/material/Typography";
import {
  closeOpenViduConnection,
  createOpenViduConnection,
} from "@/utils/openvidu";
import { Role } from "@/types";
import useJwtToken, { JwtToken } from "@/hooks/useJwtToken";
import DeviceControlButton from "@/components/meeting/DeviceControlButton";
import { fetchFanToFanMeeting } from "@/hooks/useFanMeetings";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import LinearTimerBar from "@/components/ShowTimer";
import MyStreamView from "@/components/meeting/MyStreamView";
import PartnerStreamView from "@/components/meeting/PartnerStreamView";
import ChatAndMemo from "@/components/ChatAndMemo";
import AlertSnackBar from "@/components/Timer";
import { backend_api, SPRING_URL } from "@/utils/api";
import MotionDetector from "@/components/MotionDetector";

import { fetchFanMeeting } from "@/hooks/fanmeeting";
import { v4 as uuidv4 } from "uuid";
import SpeechRecog from "../../components/Speech-Recognition";
import FilterSelectDialog from "@/components/FilterSelectDialog";
import { useAtomValue } from "jotai/react";
import { languageTargetAtom } from "@/atom";
import { Router } from "next/router";

const OneToOnePage = () => {
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(null);

  /* Query Param으로 전달된 팬미팅 아이디 */
  const searchParams = useSearchParams();
  const fanMeetingId = searchParams?.get("fanMeetingId");
  const sessionId = searchParams?.get("sessionId");
  const idolName = searchParams?.get("idolName");
  const motionType = searchParams?.get("motionType");
  const gameType = searchParams?.get("gameType");

  /* OpenVidu */
  const [OV, setOV] = useState<OpenVidu | undefined>();

  /* OpenVidu Session Info*/
  const [session, setSession] = useState<Session | undefined>();

  /* OpenVidu Stream */
  const [myStream, setMyStream] = useState<Publisher | undefined>();
  const [partnerStream, setPartnerStream] = useState<
    StreamManager | undefined
  >();

  /* 닉네임 */
  const [myNickName, setMyNickName] = useState<string | undefined>(undefined);
  const [partnerNickName, setPartnerNickName] = useState<string | undefined>(
    undefined,
  );

  /* OpenVidu Connection */
  const [myConnection, setMyConnection] = useState<Connection | undefined>();

  /* Layout */
  const [fullScreen, setFullScreen] = useState<boolean>(false);

  /* React Query FanToFanMeeting 조회 */
  const [chatRoomId, setChatRoomId] = useState<string | undefined>();

  /* 팬미팅 종료 임박 Alert */
  const [endSoon, setEndSoon] = useState<boolean>(false);

  /* SnackBar 상태 */
  const [snackBarOpen, setSnackBarOpen] = useState(false);
  const [snackBarTitle, setSnackBarTitle] = useState("");
  const [snackBarContent, setSnackBarContent] = useState("");

  /* 녹화를 위한 recordingid */
  const [forceRecordingId, setForceRecordingId] = useState("");

  /* 다음 아이돌의 대기실로 넘어가기 위해 필요한 state */
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [nextRoomId, setNextRoomId] = useState<string>("");

  /* Role */
  const token: Promise<JwtToken | null> = useJwtToken();
  const [role, setRole] = useState<Role | undefined>();
  const [userName, setUserName] = useState<string>("");

  /* 사진 촬영 */
  const [photoTime, setPhotoTime] = useState<boolean>(false);
  const [partnerPose, setPartnerPose] = useState<boolean>(false);

  /* FanMeeting 이름 */
  const [fanMeetingName, setFanMeetingName] = useState<string | undefined>();

  /* 게임시작 */
  const [gameStart, setGameStart] = useState<boolean>(false);

  /* 게임종료 */
  const [gameEnd, setGameEnd] = useState<boolean>(false);

  /* 이심전심 선택 */
  const [partnerChoice, setPartnerChoice] = useState<string | undefined>();

  /* 상대방 음성 인식 */
  const [isSubtitleActive, setSubtitleActive] = useState(false);
  const [partnerVoice, setPartnerVoice] = useState<string | undefined>();
  const langTarget = useAtomValue(languageTargetAtom);

  /* 필터 On/Off */
  const [filter, setFilter] = useState(false);
  const [filterPopupOpen, setFilterPopupOpen] = useState(false);

  /* 남은 통화 시간 */
  const [timeLimit, setTimeLimit] = useState(60);

  useEffect(() => {
    token.then((res) => {
      setRole(res?.auth);
      setUserName(res?.sub ?? "");
      setMyNickName(res?.nickname ?? "");
    });
  }, [token]);

  useEffect(() => {
    async function init() {
      if (role === Role.IDOL) {
        await fetchSSE_idol();
        await joinSession();
      } else if (role === Role.FAN) {
        await fetchSSE();
        const fanToFanMeeting = await fetchFanToFanMeeting(fanMeetingId);
        setChatRoomId(fanToFanMeeting?.chatRoomId);
        await joinSession(fanToFanMeeting?.chatRoomId);
      } else {
        await joinSession();
      }
    }

    if (role && userName !== "") {
      init();
    }
  }, [role, userName]);

  const startRecording = async () => {
    const recording_name = uuidv4();

    console.log("🎥 startRecording", {
      session: sessionId,
      fanMeetingId: fanMeetingId,
      fan: userName,
      idol: idolName,
      name: recording_name,
      hasAudio: true,
      hasVideo: true,
      outputMode: "COMPOSED",
    });

    await backend_api()
      .post(
        SPRING_URL + "/recording-java/api/recording/start",

        {
          session: sessionId,
          fanMeetingId: fanMeetingId ?? "1",
          fan: userName,
          idol: idolName,
          name: recording_name,
          hasAudio: true,
          hasVideo: true,
          outputMode: "COMPOSED",
        },
      )
      .then((response) => {
        setForceRecordingId(response.data.id);
      })
      .catch((error) => {
        // console.error("Start recording WRONG:", error);
      });
  };
  const updateShowOverlay = (newValue) => {
    setEndSoon(newValue);
  };

  const joinSession = async (_chatRoomId?: string) => {
    try {
      // OpenVidu 객체 생성
      const ov = new OpenVidu();
      setOV(ov);

      const mySession = ov.initSession();

      mySession.on("streamCreated", (event) => {
        const subscriber = mySession.subscribe(event.stream, undefined);
        setPartnerStream(subscriber);
        if (role === Role.IDOL) {
          const clientData = JSON.parse(
            event.stream.connection.data,
          ).clientData;
          const chatRoomId = JSON.parse(clientData).chatRoomId;
          const partnerNickName = JSON.parse(clientData).nickname;
          setChatRoomId(chatRoomId);
          setPartnerNickName(partnerNickName);
        }
      });

      mySession.on("streamDestroyed", (event) => {
        setPartnerStream(undefined);
      });

      mySession.on("signal:pose_detected", (event) => {
        if (event.data !== userName) {
          console.log("👋 상대방이 포즈를 취했어요.", event.data);
          setPartnerPose(true);
        }
      });

      mySession.on("signal:voice_detected", (event) => {
        const data = JSON.parse(event.data);
        if (data.username !== userName) {
          setPartnerVoice(data.translatedText);
        }
      });

      const connection = await createOpenViduConnection(sessionId);
      if (connection) {
        setMyConnection(connection);
      }
      const { token } = connection;

      if (role === Role.IDOL) {
        await mySession.connect(token, {
          clientData: JSON.stringify({
            role: role,
            fanMeetingId: fanMeetingId,
            userName: userName,
            type: "idolRoom",
            chatRoomId: _chatRoomId,
            nickname: myNickName,
            gameType: gameType,
          }),
          kurentoOptions: {
            allowedFilters: [
              "FaceOverlayFilter",
              "ChromaFilter",
              "GStreamerFilter",
            ],
          },
        });
      } else if (role === Role.FAN) {
        await mySession
          .connect(token, {
            clientData: JSON.stringify({
              role: role,
              fanMeetingId: fanMeetingId,
              userName: userName,
              type: "idolRoom",
              chatRoomId: _chatRoomId,
              nickname: myNickName,
              gameType: gameType,
              idolName: idolName,
            }),
            kurentoOptions: {
              allowedFilters: [
                "FaceOverlayFilter",
                "ChromaFilter",
                "GStreamerFilter",
              ],
            },
          })
          .then(async () => {
            if (role === Role.FAN) {
              await startRecording();
            }
          });
      }

      await ov.getUserMedia({
        audioSource: undefined,
        videoSource: undefined,
      });

      const devices = await ov.getDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput",
      );

      const newPublisher = await ov.initPublisherAsync(undefined, {
        audioSource: undefined,
        videoSource: videoDevices[0].deviceId,
        publishAudio: true,
        publishVideo: true,
        resolution: "1280x720",
        frameRate: 60,
        insertMode: "APPEND",
        mirror: false,
      });

      newPublisher.subscribeToRemote();
      mySession.publish(newPublisher);
      setSession(mySession);
      setMyStream(newPublisher);
    } catch (error) {
      console.error("Error in enterFanmeeting:", error);
      return null;
    }
  };

  const fetchSSE = async () => {
    const eventSource = new EventSource(
      `https://api.doldolmeet.shop/fanMeetings/${fanMeetingId}/sse/${userName}`,
    );

    eventSource.addEventListener("connect", (e) => {
      console.log("🥹 연결되었습니다.");
    });

    eventSource.addEventListener("moveToWaitRoom", async (e: MessageEvent) => {
      console.log("👋 moveToWaitRoom: ", JSON.parse(e.data));
      setNextRoomId(JSON.parse(e.data).nextRoomId);
      await joinNextRoom(
        JSON.parse(e.data).nextRoomId,
        JSON.parse(e.data).nextRoomType,
      );
    });

    eventSource.addEventListener("endNotice", (e: MessageEvent) => {
      console.log("🥹 통화가 곧 종료 됩니다.", JSON.parse(e.data));
      setEndSoon(true);
      setPhotoTime(true);
      setSnackBarTitle("팬미팅이 종료되기까지 10초가 남았어요!");
      setSnackBarContent("아쉽지만 통화를 마무리할 준비를 해주세요.");
      setSnackBarOpen(true);
    });

    eventSource.addEventListener("reConnect", (e: MessageEvent) => {
      console.log("🥹 재접속 되었습니다.", JSON.parse(e.data));
      setSnackBarTitle("팬미팅에 재접속 되었습니다!");
      setSnackBarContent(
        `통화시간이 ${Math.floor(e.data / 1000)}초 남았습니다.`,
      );
      setSnackBarOpen(true);
      setTimeLimit(Math.floor(e.data / 1000));
    });

    eventSource.onopen = () => {
      console.log("📣 SSE 연결되었습니다.");
    };

    eventSource.onerror = (e) => {
      // 종료 또는 에러 발생 시 할 일
      console.log("🥲 eventSource 에러가 발생했어요", e);
      // eventSource.close();
    };

    return true;
  };

  const fetchSSE_idol = async () => {
    const eventSource = new EventSource(
      `https://api.doldolmeet.shop/fanMeetings/${fanMeetingId}/sse/${userName}`,
    );

    eventSource.addEventListener("connect", (e) => {
      console.log("🥹 아이돌 SSE 연결되었습니다.");
    });

    eventSource.addEventListener("idolEndNotice", (e: MessageEvent) => {
      console.log("🥹 통화가 곧 종료 됩니다.", JSON.parse(e.data));
      setEndSoon(true);
      setPhotoTime(true);
      setSnackBarTitle("팬미팅이 종료되기까지 10초가 남았어요!");
      setSnackBarContent("아쉽지만 통화를 마무리할 준비를 해주세요.");
      setSnackBarOpen(true);
    });

    eventSource.onopen = () => {
      console.log("📣 아이돌 SSE 연결되었습니다.");
    };

    eventSource.onerror = (e) => {
      // 종료 또는 에러 발생 시 할 일
      console.log("🥲 eventSource 에러가 발생했어요", e);
      // eventSource.close();
    };

    return true;
  };
  // 세션을 나가면서 정리
  const leaveSession = async () => {
    console.log(
      `leaveSession called.🥶🥶🥶 sessionId: ${sessionId}, connectionId: ${myConnection?.connectionId}`,
    );
    if (sessionId && myConnection?.connectionId) {
      await closeOpenViduConnection(sessionId, myConnection?.connectionId);
      console.log("🥲🤡🤡🤡 세션🤡🤡을 나갔습니다.");
    }

    // state 초기화
    setMyStream(undefined);
    setPartnerStream(undefined);
    setMyConnection(undefined);
  };

  useEffect(() => {
    // 첫 렌더링에서는 skip하고, 이후 경로가 변경될 때마다 체크
    if (prevPathRef.current !== null && prevPathRef.current !== pathname) {
      console.log(
        `경로가 ${prevPathRef.current}에서 ${pathname}으로 변경되었습니다.`,
      );
      leaveSession();
    }

    // 현재의 pathname을 저장
  }, [pathname, searchParams]);

  const handleRouterChangeStart = (url: string) => {
    console.log("handleRouterChangeStart", url);
    leaveSession();
    Router.events.emit("routeChangeError");
  };

  useEffect(() => {
    Router.events.on("routeChangeStart", handleRouterChangeStart);
    return () => {
      Router.events.off("routeChangeStart", handleRouterChangeStart);
    };
  }, [Router.events]);

  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      console.log("😡😡😡😡😡😡😡😡😡😡😡😡😡😡😡😡.");
      Router.events.on("routeChangeStart", (url) => {
        console.log(`App is changing to ${url}`);
        leaveSession();
      });
      await leaveSession();
      console.log("🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠🧠");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const joinNextRoom = async (sessionId: string, nextRoomType: string) => {
    if (nextRoomType === "gameRoom") {
      router.push(`/game-page/${fanMeetingId}/${sessionId}`);
    } else {
      router.push(
        `/one-idol-waitingroom?fanMeetingId=${fanMeetingId}&sessionId=${sessionId}`,
      );
    }
  };

  const fetchFanMeetingTitle = async () => {
    try {
      const fanMeeting = await fetchFanMeeting(fanMeetingId);

      if (fanMeeting) {
        setFanMeetingName(fanMeeting.title);
      }
    } catch (error) {
      console.error("FanMeeting fetch error:", error);
    }
  };

  useEffect(() => {
    if (fanMeetingId) {
      fetchFanMeetingTitle();
    }
  }, [fanMeetingId]);

  const toggleFilter = async () => {
    if (filter) {
      await myStream?.stream.removeFilter();
      setFilter(false);
    } else {
      setFilterPopupOpen(true);
    }
  };

  const onClickApplyFilter = async (filterUrl: string, toPartner: boolean) => {
    const targetStream = toPartner ? partnerStream : myStream;

    await targetStream?.stream
      .applyFilter("FaceOverlayFilter", {})
      .then((filter) => {
        filter.execMethod("setOverlayedImage", {
          uri: filterUrl,
          offsetXPercent: -0.2,
          offsetYPercent: -0.8,
          widthPercent: 1.4,
          heightPercent: 1.0,
        });
      });

    if (!toPartner) {
      setFilter(true);
    }
    setFilterPopupOpen(false);
  };

  return (
    <Grid container spacing={2}>
      <Grid
        item
        xs={fullScreen ? 12 : 8.5}
        sx={{
          backgroundColor: "rgba(238,238,238,0.7)",
          borderRadius: 5,
          padding: 2,
        }}
      >
        <Grid
          container
          direction="row"
          justifyContent="center"
          alignItems={"flex-start"}
        >
          <Grid item xs={12}>
            <Stack
              direction={"row"}
              justifyContent="space-between"
              alignItems="center"
              sx={{
                backgroundColor: "transparent",
                px: 2,
                mb: 2,
                height: 60,
              }}
            >
              <Typography variant={"h4"}>
                {fanMeetingName && `💜 ${fanMeetingName} 💜`}
              </Typography>
              <LinearTimerBar timeLimit={timeLimit} />
              <DeviceControlButton
                publisher={myStream}
                fullScreen={fullScreen}
                toggleFullScreen={() => setFullScreen(!fullScreen)}
                filterOn={filter}
                onClickFilter={toggleFilter}
                toggleSubtitle={() => setSubtitleActive(!isSubtitleActive)}
                isSubtitleActive={isSubtitleActive}
              />
            </Stack>
          </Grid>
          <Grid
            item
            id="video-container"
            xs={12}
            container
            justifyContent="space-between"
          >
            <Grid item xs={6}>
              {role === Role.IDOL ? (
                <MyStreamView
                  name={`😎 ${idolName ?? "아이돌"}`}
                  stream={myStream}
                  left={true}
                  showOverlay={endSoon}
                  motionType={motionType}
                />
              ) : (
                <PartnerStreamView
                  name={`😎 ${idolName ?? "아이돌"}`}
                  stream={partnerStream}
                  partnerRole={Role.IDOL}
                  left={true}
                  showOverlay={endSoon}
                  motionType={motionType}
                />
              )}
            </Grid>
            <Grid item xs={6}>
              {role === Role.FAN ? (
                <MyStreamView
                  name={`😍 ${myNickName ?? "팬"}`}
                  stream={myStream}
                  left={false}
                  showOverlay={endSoon}
                  motionType={motionType}
                />
              ) : (
                <PartnerStreamView
                  name={`😍 ${partnerNickName ?? "팬"}`}
                  stream={partnerStream}
                  partnerRole={Role.FAN}
                  left={false}
                  showOverlay={endSoon}
                  motionType={motionType}
                />
              )}
            </Grid>
          </Grid>
          <Grid item xs={12}>
            {isSubtitleActive && (
              <SpeechRecog
                sessionId={sessionId}
                partnerVoice={partnerVoice}
                username={userName}
                active={isSubtitleActive}
                languageTarget={langTarget}
              />
            )}
          </Grid>
        </Grid>
      </Grid>

      {!fullScreen && (
        <Grid
          item
          xs={3.5}
          sx={{
            backgroundColor: "rgba(238,238,238,0.7)",
            borderRadius: 5,
            padding: 2,
          }}
        >
          <ChatAndMemo chatRoomId={chatRoomId} height={"75vh"} />
        </Grid>
      )}
      <AlertSnackBar
        open={snackBarOpen}
        handleClose={() => setSnackBarOpen(false)}
        title={snackBarTitle}
        content={snackBarContent}
      />
      {fanMeetingId && idolName && sessionId && userName && photoTime && (
        <MotionDetector
          role={role}
          fanMeetingId={fanMeetingId}
          idolName={idolName}
          sessionId={sessionId}
          partnerPose={partnerPose}
          username={userName}
          motionType={motionType}
          updateShowOverlay={updateShowOverlay}
        />
      )}
      <FilterSelectDialog
        popupOpen={filterPopupOpen}
        onClose={() => setFilterPopupOpen(false)}
        onClickApplyFilter={onClickApplyFilter}
      />
    </Grid>
  );
};

export default OneToOnePage;
