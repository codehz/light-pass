import React from "react";

const FormattedTime = ({ time }: { time: number }) => {
  // Convert timestamp to formatted local time string
  const formattedDate = new Date(time).toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: true,
  });

  return formattedDate;
};

export default FormattedTime;
