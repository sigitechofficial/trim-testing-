exports.convertTo24HourFormat = time12Hour => {
  const date = new Date(`2021-01-01 ${time12Hour}`);
  const time24Hour = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return time24Hour;
};

exports.convertTo12HourFormat= time24 => {
  // Split the input time into hours and minutes
  const [hours, minutes] = time24.split(":").map(Number);
  // Determine if it's AM or PM
  const period = hours < 12 ? "AM" : "PM";
  // Convert hours to 12-hour format
  const hours12 = hours % 12 || 12;
  const time12 = `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
  return time12;
}

exports.dayOnDate = date => {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayIndex = date.getDay();
  return daysOfWeek[dayIndex];
}


exports.TwoMonthStartEndDate = () =>{
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Last date of the current month
  const lastDateOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);

  // Start date of the previous month
  const startDateOfPreviousMonth = new Date(currentYear, currentMonth - 1, 1);

  return {
      lastDateOfCurrentMonth: lastDateOfCurrentMonth.toISOString().substring(0, 10),
      startDateOfPreviousMonth: startDateOfPreviousMonth.toISOString().substring(0, 10)
  };
}
 
 

exports.stampToDate= timestamp => {
  const date = new Date(timestamp * 1000); 

  // Get the year, month, and day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0') 
  const day = String(date.getDate()).padStart(2, '0');
 
  const formattedDate = year + '-' + month + '-' + day;
  return formattedDate;
}

