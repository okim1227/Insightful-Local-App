let currentEmployeeId = null;
let currentEntryId = null;
let timerInterval = null;
let screenshotInterval = null;
let secondsElapsed = 0;
let clockTimes = [];
let clockInTime = null;

document.getElementById('loginButton').addEventListener('click', login);
document.getElementById('startButton').addEventListener('click', startTracking);
document.getElementById('stopButton').addEventListener('click', stopTracking);

async function login() {
  const email = document.getElementById('employeeEmail').value;
  const token = document.getElementById('employeeToken').value;

  try {
    const res = await axios.post('http://localhost:3001/api/v1/auth/verify', { email, token });
    console.log('🔐 Login success:', res.data);

    const employee = res.data.employee || {};
    currentEmployeeId = employee.id || null;

    localStorage.setItem('authToken', res.data.token || '');
    localStorage.setItem('employeeEmail', employee.email || email);

    document.getElementById('login-section').style.display = 'none';
    document.getElementById('tracker-section').style.display = 'block';

    // Load and populate project dropdown
    try {
      const projectRes = await axios.get(`http://localhost:3001/api/v1/employee/${currentEmployeeId}/projects`);
      console.log('📁 Loaded projects:', projectRes.data);

      const projectSelect = document.getElementById('projectSelect');
      projectSelect.innerHTML = '<option value="">-- Select a project --</option>';

      if (Array.isArray(projectRes.data)) {
        projectRes.data.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.text = project.name;
          projectSelect.appendChild(option);
        });
      } else {
        console.warn('Unexpected project response format:', projectRes.data);
      }
    } catch (err) {
      console.error('Failed to load projects:', err.message || err);
    }

  } catch (error) {
    console.error('Login error:', error.message || error);
    alert('Login failed. Check your email and token.');
  }
}

async function startTracking() {
  const projectId = document.getElementById('projectSelect').value;
  if (!projectId || !currentEmployeeId) {
    alert('Missing project or employee info. Please login and select a project.');
    return;
  }

  console.log('Start tracking payload:', {
    task_id: projectId,
    employee_id: currentEmployeeId
  });

  try {
    const res = await axios.post('http://localhost:3001/api/v1/time', {
      task_id: projectId,
      employee_id: currentEmployeeId
    });

    clockInTime = new Date();
    currentEntryId = res.data.id;

    updateStatus();
    timerInterval = setInterval(updateTimer, 1000);
    screenshotInterval = setInterval(captureScreenshot, 2000); // this was in ms not seconds

    startEyesAnimation();
    document.getElementById('startButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
  } catch (error) {
    console.error('Backend error:', error);
    alert('Failed to start tracking! Check backend is running.');
  }
}

async function stopTracking() {
  if (!clockInTime || !currentEntryId) {
    alert('No active tracking session.');
    return;
  }

  try {
    await axios.patch(`http://localhost:3001/api/v1/time/${currentEntryId}`);

    const clockOutTime = new Date();
    clockTimes.push({ clockIn: clockInTime, clockOut: clockOutTime });

    clockInTime = null;
    currentEntryId = null;
    clearInterval(timerInterval);
    clearInterval(screenshotInterval);
    screenshotInterval = null;
    timerInterval = null;
    secondsElapsed = 0;
    updateStatus();

    document.getElementById('startButton').disabled = false;
    document.getElementById('stopButton').disabled = true;

    renderClockTimes();
  } catch (error) {
    console.error('Backend error:', error);
    alert('Failed to stop tracking.');
  }
}

async function captureScreenshot() {
  try {
    const sources = await window.desktopCapturerBridge.getSources({ types: ['screen'] });
    const screen = sources.find(src => src.name.includes('Screen')) || sources[0];

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: screen.id,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720,
        }
      }
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const base64Image = canvas.toDataURL('image/png').split(',')[1];
    stream.getTracks().forEach(t => t.stop());

    await axios.post('http://localhost:3001/api/v1/screenshot', {
      employee_id: currentEmployeeId,
      captured_at: new Date(),
      image_data: base64Image,
      permission: true
    });

    console.log('Screenshot captured and uploaded');
  } catch (error) {
    console.error('Screenshot failed:', error.message);
  }
}
  
function updateStatus() {
  const status = document.getElementById('status');
  const eyes = document.getElementById('eyes');

  if (timerInterval) {
    status.innerText = `Tracking: ${secondsElapsed}s`;
    eyes.style.display = 'block';
  } else {
    status.innerText = 'Not tracking';
    eyes.style.display = 'none';
  }
}

function updateTimer() {
  secondsElapsed++;
  updateStatus();
}

function renderClockTimes() {
  const historyDiv = document.getElementById('history');
  historyDiv.innerHTML = '';

  clockTimes.forEach(entry => {
    const clockIn = new Date(entry.clockIn).toLocaleTimeString();
    const clockOut = new Date(entry.clockOut).toLocaleTimeString();
    const durationMs = new Date(entry.clockOut) - new Date(entry.clockIn);
    const durationMin = (durationMs / 60000).toFixed(2);

    const entryDiv = document.createElement('div');
    entryDiv.classList.add('entry');
    entryDiv.innerHTML = `
      <strong>Clock In:</strong> ${clockIn} |
      <strong>Clock Out:</strong> ${clockOut} |
      <strong>Duration:</strong> ${durationMin} min
    `;
    historyDiv.appendChild(entryDiv);
  });

  historyDiv.scrollTo({
    top: historyDiv.scrollHeight,
    behavior: 'smooth'
  });
}

// eyes animation, spent way too long on this fml
let eyesInterval = null;

function startEyesAnimation() {
  const eyes = document.getElementById('eyes');
  eyes.style.display = 'block';
  eyesInterval = setInterval(() => {
    eyes.innerText = eyes.innerText === '👀' ? '😳' : '👀';
  }, 700);
}

function stopEyesAnimation() {
  const eyes = document.getElementById('eyes');
  clearInterval(eyesInterval);
  eyes.style.display = 'none';
}
