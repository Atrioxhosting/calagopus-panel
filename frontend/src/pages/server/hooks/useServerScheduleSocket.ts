import { useShallow } from 'zustand/react/shallow';
import getSchedule from '@/api/server/schedules/getSchedule.ts';
import { queryKeys } from '@/lib/queryKeys.ts';
import useWebsocketEvent, { SocketEvent } from '@/plugins/websocket/useWebsocketEvent.ts';
import { useServerStore, useServerStoreApi } from '@/stores/server.ts';
import useInvalidateServerCache from './useInvalidateServerCache.ts';

export default function useServerScheduleSocket() {
  const serverStoreApi = useServerStoreApi();
  const invalidateCacheKey = useInvalidateServerCache();
  const { setRunningScheduleStep, setScheduleSteps, recordScheduleCompletion, setSchedule } = useServerStore(
    useShallow((state) => ({
      setRunningScheduleStep: state.setRunningScheduleStep,
      setScheduleSteps: state.setScheduleSteps,
      recordScheduleCompletion: state.recordScheduleCompletion,
      setSchedule: state.setSchedule,
    })),
  );

  useWebsocketEvent(SocketEvent.SCHEDULE_STARTED, (uuid) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => ({ ...s, error: null })));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_STATUS, (uuid, stepUuid) => {
    setRunningScheduleStep(uuid, stepUuid);
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_STEP_ERROR, (uuid, stepUuid, error) => {
    const { schedule, scheduleSteps } = serverStoreApi.getState();
    if (schedule?.uuid === uuid) {
      setScheduleSteps(scheduleSteps.map((s) => (s.uuid === stepUuid ? { ...s, error } : s)));
    }
  });

  useWebsocketEvent(SocketEvent.SCHEDULE_COMPLETED, (uuid, successful, timestamp) => {
    setRunningScheduleStep(uuid, null);
    if (timestamp) {
      recordScheduleCompletion(uuid, new Date(timestamp), successful === 'true');
    }

    const serverUuid = serverStoreApi.getState().server.uuid;
    invalidateCacheKey(queryKeys.server(serverUuid).schedules.all());

    if (serverStoreApi.getState().schedule?.uuid === uuid) {
      getSchedule(serverUuid, uuid)
        .then((fetched) => {
          if (serverStoreApi.getState().schedule?.uuid === uuid) {
            setSchedule(fetched);
          }
        })
        .catch((e) => console.error(e));
    }
  });
}
