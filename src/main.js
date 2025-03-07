const { CogsConnection } = COGS;

const cogsConnection = new CogsConnection();

// Timestamps in seconds
let timestampsToReport = [];

// Timer state
let timerTicking = false;
let timerStartedTickingAt = 0;
let timerDurationMillis = 0;

// Timeouts keyed on the timestamp
let alertTimeouts = {};

function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function setAlertTimeouts() {
  const now = Date.now();

  // Clear previous timeouts
  if (Object.keys(alertTimeouts).length > 0) {
    // If the timer has stopped, make sure to alert for any timestamps that have passed
    // This deals with the case where the timer stops at 00:00 which otherwise can cause
    // a race condition where the alert is not triggered
    if (!timerTicking) {
      Object.keys(alertTimeouts).forEach((timestamp) => {
        if (timerDurationMillis <= timestamp * 1000) {
          console.log(`Alerting for ${formatTime(timestamp)}`);
          cogsConnection.sendEvent("Timestamp reached", parseInt(timestamp));
        }
      });
    }

    console.log("Clearing all previous timeouts");
    Object.values(alertTimeouts).forEach((timeout) => clearTimeout(timeout));
    alertTimeouts = {};
  }

  if (timerTicking && timestampsToReport.length > 0) {
    for (const timestamp of timestampsToReport) {
      const timeToAlert =
        timerDurationMillis - timestamp * 1000 - (now - timerStartedTickingAt);
      if (timeToAlert > 0) {
        console.log(
          `Setting alert for ${formatTime(timestamp)} in ${timeToAlert}ms`
        );

        alertTimeouts[timestamp] = setTimeout(() => {
          console.log(`Alerting for ${formatTime(timestamp)}`);
          cogsConnection.sendEvent("Timestamp reached", timestamp);

          delete alertTimeouts[timestamp];
        }, timeToAlert);
      }
    }
  }
}

cogsConnection.addEventListener("config", ({ config }) => {
  const timestampsToReportString = config["Timestamps to report"];
  if (timestampsToReportString) {
    // Unique numeric timestamps
    timestampsToReport = [
      ...new Set(
        timestampsToReportString
          .split(",")
          .map((x) => parseInt(x))
          .filter((x) => !isNaN(x))
      ),
    ];

    setAlertTimeouts();
  }
});

cogsConnection.addEventListener("message", ({ message }) => {
  // Show reset
  if (message.type === "show_reset") {
    // TODO
  }
  // Timer update
  else if (message.type === "adjustable_timer_update") {
    // console.log(
    //   "Adjustable timer update",
    //   message.ticking,
    //   message.durationMillis
    // );
    timerTicking = message.ticking;
    timerStartedTickingAt = timerTicking ? Date.now() : 0;
    timerDurationMillis = message.durationMillis;

    setAlertTimeouts();
  }
});
