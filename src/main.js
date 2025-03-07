const { CogsConnection } = COGS;

const cogsConnection = new CogsConnection();

// Timestamps in seconds
let timestampsToReport = [];
let reportIfSkippedPast = false;
let allowMultipleReportsPerShow = false;

// Timer state
let timerTicking = false;
let timerStartedTickingAt = 0;
let timerDurationMillis = 0;

// Timeouts keyed on the timestamp
let timeoutsReportedThisShow = new Set();
let alertTimeouts = {};

function formatTime(timeInSeconds) {
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = timeInSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function sendTimestampAlertToCogs(timestamp) {
  const timestampAsInt = parseInt(timestamp);
  if (
    !timeoutsReportedThisShow.has(timestampAsInt) ||
    allowMultipleReportsPerShow
  ) {
    console.log(`Alerting for ${formatTime(timestampAsInt)}`);
    cogsConnection.sendEvent("Timestamp reached", timestampAsInt);

    timeoutsReportedThisShow.add(timestampAsInt);
  }
}

function setAlertTimeouts() {
  const now = Date.now();

  // Clear previous timeouts
  if (Object.keys(alertTimeouts).length > 0) {
    // Check for timestamps that have been skipped past. This can happen when the timer is manually adjusted to a new value
    // whilst it is ticking
    if (timerTicking && reportIfSkippedPast) {
      Object.keys(alertTimeouts).forEach((timestamp) => {
        if (timerDurationMillis <= timestamp * 1000) {
          sendTimestampAlertToCogs(timestamp);
        }
      });
    }

    // If the timer has stopped, make sure to alert for any timestamps that have passed
    // This deals with the case where the timer stops at 00:00 which otherwise can cause
    // a race condition where the alert is not triggered
    if (!timerTicking) {
      Object.keys(alertTimeouts).forEach((timestamp) => {
        if (timerDurationMillis <= timestamp * 1000) {
          sendTimestampAlertToCogs(timestamp);
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
          sendTimestampAlertToCogs(timestamp);

          delete alertTimeouts[timestamp];
        }, timeToAlert);
      }
    }
  }
}

function sendTimerStateToCogs() {
  cogsConnection.setState({
    "Timer State": timerTicking ? "Ticking" : "Paused",
  });
}

cogsConnection.addEventListener("config", ({ config }) => {
  // Timestamps to report
  if (config["Timestamps to report"] !== undefined) {
    // Unique numeric timestamps
    timestampsToReport = [
      ...new Set(
        config["Timestamps to report"]
          .split(",")
          .map((x) => parseInt(x))
          .filter((x) => !isNaN(x))
      ),
    ];

    setAlertTimeouts();
  }

  // Report if skipped past
  if (config["Report if skipped past"] !== undefined) {
    reportIfSkippedPast = config["Report if skipped past"];
  }

  // Allow multiple reports per show
  if (config["Allow multiple reports per show"] !== undefined) {
    allowMultipleReportsPerShow = config["Allow multiple reports per show"];
  }
});

cogsConnection.addEventListener("message", ({ message }) => {
  // Show reset
  if (message.type === "show_reset") {
    timeoutsReportedThisShow.clear();
  }
  // Timer update
  else if (message.type === "adjustable_timer_update") {
    timerTicking = message.ticking;
    timerStartedTickingAt = timerTicking ? Date.now() : 0;
    timerDurationMillis = message.durationMillis;

    sendTimerStateToCogs();
    setAlertTimeouts();
  }
});
