import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useEffect, useState } from "react";

const RelativeTime = ({ time }: { time: number }) => {
  const [relativeTime, setRelativeTime] = useState(
    formatDistanceToNow(time, { addSuffix: true, locale: zhCN }),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRelativeTime(
        formatDistanceToNow(time, { addSuffix: true, locale: zhCN }),
      );
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [time]);

  return relativeTime;
};

export default RelativeTime;
