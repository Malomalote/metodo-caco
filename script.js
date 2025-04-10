// Datos del plan de entrenamiento CaCo
const trainingPlan = [
    { week: 1, totalMinutes: 30, blocks: 6, walkMinutes: 4, walkSeconds: 0, runMinutes: 1, runSeconds: 0 },
    { week: 2, totalMinutes: 35, blocks: 7, walkMinutes: 4, walkSeconds: 0, runMinutes: 1, runSeconds: 0 },
    { week: 3, totalMinutes: 30, blocks: 6, walkMinutes: 3, walkSeconds: 0, runMinutes: 2, runSeconds: 0 },
    { week: 4, totalMinutes: 35, blocks: 7, walkMinutes: 3, walkSeconds: 0, runMinutes: 2, runSeconds: 0 },
    { week: 5, totalMinutes: 40, blocks: 8, walkMinutes: 3, walkSeconds: 0, runMinutes: 2, runSeconds: 0 },
    { week: 6, totalMinutes: 40, blocks: 8, walkMinutes: 2, walkSeconds: 0, runMinutes: 3, runSeconds: 0 },
    { week: 7, totalMinutes: 45, blocks: 9, walkMinutes: 2, walkSeconds: 0, runMinutes: 3, runSeconds: 0 },
    { week: 8, totalMinutes: 35, blocks: 7, walkMinutes: 1, walkSeconds: 30, runMinutes: 3, runSeconds: 30 },
    { week: 9, totalMinutes: 35, blocks: 7, walkMinutes: 1, walkSeconds: 0, runMinutes: 4, runSeconds: 0 },
    { week: 10, totalMinutes: 40, blocks: 8, walkMinutes: 0, walkSeconds: 30, runMinutes: 4, runSeconds: 30 }
];

// Web Audio API - Sistema de audio
let audioContext;
let audioBuffers = {};
const audioFiles = {
    walk: 'caminar.mp3',
    run: 'correr.mp3',
    warmup: 'calentamiento.mp3',
    bip: 'bip.mp3',
    complete: 'completado.mp3'
};
let currentAudio = null;

// Inicializar el sistema de audio
async function initAudioSystem() {
    try {
        // Crear contexto de audio solo cuando se necesite (para evitar problemas con políticas de autoplay)
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Cargar todos los archivos de audio
        const loadPromises = Object.entries(audioFiles).map(async ([key, url]) => {
            try {
                const buffer = await loadAudioFile(url);
                audioBuffers[key] = buffer;
            } catch (err) {
                console.error(`Error cargando archivo de audio ${url}:`, err);
            }
        });
        
        await Promise.all(loadPromises);
        console.log('Sistema de audio inicializado correctamente');
    } catch (err) {
        console.error('Error inicializando sistema de audio:', err);
    }
}

// Cargar un archivo de audio
async function loadAudioFile(url) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

// Reproducir un sonido
function playSound(soundName, options = {}) {
    if (!audioContext) {
        console.warn('Sistema de audio no inicializado');
        return null;
    }
    
    // Si hay un sonido reproduciéndose con la opción stopPrevious, detenerlo
    if (options.stopPrevious && currentAudio) {
        currentAudio.stop();
        currentAudio = null;
    }
    
    try {
        const buffer = audioBuffers[soundName];
        if (!buffer) {
            console.warn(`Sonido ${soundName} no encontrado`);
            return null;
        }
        
        // Crear fuente de sonido
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Configurar volumen si es necesario
        if (options.volume !== undefined && options.volume !== 1) {
            const gainNode = audioContext.createGain();
            gainNode.gain.value = options.volume;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
        } else {
            source.connect(audioContext.destination);
        }
        
        // Configurar loop si es necesario
        if (options.loop) {
            source.loop = true;
        }
        
        // Reproducir
        source.start(0);
        
        // Guardar referencia si es necesario
        if (options.saveReference) {
            currentAudio = source;
        }
        
        // Devolver la fuente para poder detenerla más tarde si es necesario
        return source;
    } catch (err) {
        console.error(`Error reproduciendo sonido ${soundName}:`, err);
        return null;
    }
}

// Detener un sonido específico
function stopSound(source) {
    if (source) {
        try {
            source.stop();
        } catch (err) {
            console.error('Error al detener sonido:', err);
        }
    }
}

// Elementos del DOM
const weekSelector = document.getElementById('week-selector');
const activityType = document.getElementById('activity-type');
const minutesDisplay = document.getElementById('minutes');
const secondsDisplay = document.getElementById('seconds');
const progressBar = document.getElementById('progress-bar');
const currentBlockDisplay = document.getElementById('current-block');
const totalBlocksDisplay = document.getElementById('total-blocks');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const weekDetails = document.getElementById('week-details');
const completedWorkoutsDisplay = document.getElementById('completed-workouts');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthDisplay = document.getElementById('current-month');
const calendarContainer = document.getElementById('calendar');

// Elementos del modal
const warmupModal = document.getElementById('warmup-modal');
const closeModalBtn = document.querySelector('.close-modal');
const acknowledgeBtn = document.getElementById('acknowledge-btn');

// Variables de estado
let timer;
let currentWeek = 1;
let currentActivity = 'walk'; // 'walk' o 'run'
let currentBlock = 0;
let totalBlocks = 0;
let timeRemaining = 0;
let totalTimeForActivity = 0;
let isRunning = false;
let isPaused = false;
let workoutCompleted = false;
let currentDate = new Date();
let completedWorkouts = [];

// Inicializar la aplicación
function init() {
    loadFromLocalStorage();
    updateWeekDetails();
    renderCalendar();
    updateCompletedWorkouts();
    
    // Event listeners
    weekSelector.addEventListener('change', handleWeekChange);
    startBtn.addEventListener('click', showWarmupModal);
    pauseBtn.addEventListener('click', pauseWorkout);
    stopBtn.addEventListener('click', stopWorkout);
    prevMonthBtn.addEventListener('click', () => navigateMonth(-1));
    nextMonthBtn.addEventListener('click', () => navigateMonth(1));
    
    // Event listeners para el modal
    closeModalBtn.addEventListener('click', closeWarmupModal);
    acknowledgeBtn.addEventListener('click', acknowledgeWarmup);
    window.addEventListener('click', (e) => {
        if (e.target === warmupModal) {
            closeWarmupModal();
        }
    });
}

// Cargar datos desde localStorage
function loadFromLocalStorage() {
    const savedData = localStorage.getItem('cacoPlanData');
    if (savedData) {
        const data = JSON.parse(savedData);
        completedWorkouts = data.completedWorkouts || [];
        currentWeek = data.currentWeek || 1;
        weekSelector.value = currentWeek;
    }
}

// Guardar datos en localStorage
function saveToLocalStorage() {
    const data = {
        completedWorkouts,
        currentWeek
    };
    localStorage.setItem('cacoPlanData', JSON.stringify(data));
}

// Actualizar detalles de la semana seleccionada
function updateWeekDetails() {
    const weekData = trainingPlan[currentWeek - 1];
    totalBlocks = weekData.blocks;
    
    weekDetails.innerHTML = `
        <p><strong>Semana ${weekData.week}:</strong> ${weekData.totalMinutes} minutos totales</p>
        <p>${weekData.blocks} bloques de 5 minutos</p>
        <p>Cada bloque: ${formatTime(weekData.walkMinutes, weekData.walkSeconds)} caminando, 
           ${formatTime(weekData.runMinutes, weekData.runSeconds)} corriendo</p>
    `;
    
    totalBlocksDisplay.textContent = totalBlocks;
}

// Manejar cambio de semana
function handleWeekChange() {
    currentWeek = parseInt(weekSelector.value);
    updateWeekDetails();
    saveToLocalStorage();
}

// Mostrar modal de calentamiento
function showWarmupModal() {
    // Si está pausado, simplemente reanudamos sin mostrar el modal
    if (isPaused) {
        resumeWorkout();
        return;
    }
    
    // Asegurarse de que el sistema de audio esté inicializado
    if (!audioContext) {
        initAudioSystem().then(() => {
            warmupModal.style.display = 'block';
            // Reproducir audio de instrucciones de calentamiento
            playSound('warmup', { saveReference: true, stopPrevious: true });
        });
    } else {
        warmupModal.style.display = 'block';
        // Reproducir audio de instrucciones de calentamiento
        playSound('warmup', { saveReference: true, stopPrevious: true });
    }
}

// Cerrar modal de calentamiento
function closeWarmupModal() {
    warmupModal.style.display = 'none';
    // Detener audio de calentamiento
    if (currentAudio) {
        stopSound(currentAudio);
        currentAudio = null;
    }
}

// Confirmar calentamiento y comenzar entrenamiento
function acknowledgeWarmup() {
    closeWarmupModal();
    actuallyStartWorkout();
}

// Iniciar entrenamiento (después de confirmar calentamiento)
function actuallyStartWorkout() {
    const weekData = trainingPlan[currentWeek - 1];
    totalBlocks = weekData.blocks;
    currentBlock = 1;
    currentActivity = 'walk';
    
    // Configurar tiempo para caminar
    timeRemaining = (weekData.walkMinutes * 60) + weekData.walkSeconds;
    totalTimeForActivity = timeRemaining;
    
    // Actualizar UI
    activityType.textContent = 'Caminar';
    activityType.className = 'activity-walk';
    currentBlockDisplay.textContent = currentBlock;
    totalBlocksDisplay.textContent = totalBlocks;
    updateTimerDisplay();
    
    // Cambiar estado de botones
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
    
    isRunning = true;
    workoutCompleted = false;
    
    // Iniciar temporizador
    timer = setInterval(updateTimer, 1000);
}

// Pausar entrenamiento
function pauseWorkout() {
    clearInterval(timer);
    isPaused = true;
    isRunning = false;
    
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Continuar';
    pauseBtn.disabled = true;
}

// Reanudar entrenamiento
function resumeWorkout() {
    isPaused = false;
    isRunning = true;
    
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    
    timer = setInterval(updateTimer, 1000);
}

// Detener entrenamiento
function stopWorkout() {
    clearInterval(timer);
    isRunning = false;
    isPaused = false;
    
    // Resetear UI
    activityType.textContent = 'Preparado';
    activityType.className = '';
    minutesDisplay.textContent = '00';
    secondsDisplay.textContent = '00';
    progressBar.style.width = '0%';
    currentBlockDisplay.textContent = '0';
    
    // Resetear botones
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar';
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
}

// Actualizar temporizador
function updateTimer() {
    if (timeRemaining > 0) {
        // Reproducir pitidos en los últimos 3 segundos antes de cambiar de modo
        if (timeRemaining <= 3) {
            // Reproducir sonido de bip con volumen bajo para no interrumpir música
            playSound('bip', { volume: 0.5 });
        }
        
        timeRemaining--;
        updateTimerDisplay();
        
        // Actualizar barra de progreso
        const progress = 100 - ((timeRemaining / totalTimeForActivity) * 100);
        progressBar.style.width = `${progress}%`;
        
    } else {
        // Cambio de actividad o bloque
        if (currentActivity === 'walk') {
            // Cambiar a correr
            currentActivity = 'run';
            const weekData = trainingPlan[currentWeek - 1];
            timeRemaining = (weekData.runMinutes * 60) + weekData.runSeconds;
            totalTimeForActivity = timeRemaining;
            
            activityType.textContent = 'Correr';
            activityType.className = 'activity-run';
            
            // Reproducir sonido de aviso para correr
            playSound('run', { volume: 0.7 });
            
        } else {
            // Fin del bloque actual
            if (currentBlock < totalBlocks) {
                // Pasar al siguiente bloque
                currentBlock++;
                currentBlockDisplay.textContent = currentBlock;
                
                // Volver a caminar
                currentActivity = 'walk';
                const weekData = trainingPlan[currentWeek - 1];
                timeRemaining = (weekData.walkMinutes * 60) + weekData.walkSeconds;
                totalTimeForActivity = timeRemaining;
                
                activityType.textContent = 'Caminar';
                activityType.className = 'activity-walk';
                
                // Reproducir sonido de aviso para caminar
                playSound('walk', { volume: 0.7 });
                
            } else {
                // Entrenamiento completado
                completeWorkout();
            }
        }
        
        updateTimerDisplay();
        progressBar.style.width = '0%';
    }
}

// Completar entrenamiento
function completeWorkout() {
    clearInterval(timer);
    isRunning = false;
    workoutCompleted = true;
    
    // Reproducir sonido de finalización
    playSound('complete', { volume: 0.7 });
    
    // Actualizar UI
    activityType.textContent = '¡Completado!';
    activityType.className = '';
    
    // Resetear botones
    startBtn.disabled = false;
    startBtn.innerHTML = '<i class="fas fa-play"></i> Iniciar';
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
    
    // Guardar entrenamiento completado
    const today = new Date().toISOString().split('T')[0];
    if (!completedWorkouts.includes(today)) {
        completedWorkouts.push(today);
        saveToLocalStorage();
        renderCalendar();
        updateCompletedWorkouts();
    }
}

// Actualizar display del temporizador
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    minutesDisplay.textContent = minutes.toString().padStart(2, '0');
    secondsDisplay.textContent = seconds.toString().padStart(2, '0');
}

// Formatear tiempo para mostrar
function formatTime(minutes, seconds) {
    if (minutes === 0) {
        return `${seconds}"`;
    } else if (seconds === 0) {
        return `${minutes}'`;
    } else {
        return `${minutes}'${seconds}"`;
    }
}

// Actualizar contador de entrenamientos completados
function updateCompletedWorkouts() {
    completedWorkoutsDisplay.textContent = completedWorkouts.length;
}

// Navegación del calendario
function navigateMonth(change) {
    currentDate.setMonth(currentDate.getMonth() + change);
    renderCalendar();
}

// Renderizar calendario
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Actualizar título del mes
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    currentMonthDisplay.textContent = `${monthNames[month]} ${year}`;
    
    // Limpiar calendario
    calendarContainer.innerHTML = '';
    
    // Agregar encabezados de días
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    dayNames.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-header';
        dayHeader.textContent = day;
        calendarContainer.appendChild(dayHeader);
    });
    
    // Obtener primer día del mes y último día
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Agregar días del mes anterior para completar la primera semana
    const firstDayOfWeek = firstDay.getDay();
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = prevMonthLastDay - i;
        calendarContainer.appendChild(day);
    }
    
    // Agregar días del mes actual
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    const todayDate = today.getDate();
    
    for (let i = 1; i <= lastDay.getDate(); i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day';
        day.textContent = i;
        
        // Marcar el día de hoy
        if (isCurrentMonth && i === todayDate) {
            day.classList.add('today');
        }
        
        // Marcar entrenamientos completados
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        if (completedWorkouts.includes(dateStr)) {
            day.classList.add('completed');
        }
        
        calendarContainer.appendChild(day);
    }
    
    // Agregar días del mes siguiente para completar la última semana
    const lastDayOfWeek = lastDay.getDay();
    const daysToAdd = 6 - lastDayOfWeek;
    
    for (let i = 1; i <= daysToAdd; i++) {
        const day = document.createElement('div');
        day.className = 'calendar-day other-month';
        day.textContent = i;
        calendarContainer.appendChild(day);
    }
}

// Iniciar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    init();
    
    // Inicializar el sistema de audio cuando el usuario interactúa con la página
    // Esto es necesario para evitar problemas con las políticas de autoplay
    const handleUserInteraction = () => {
        initAudioSystem();
        // Eliminar los event listeners después de la primera interacción
        document.removeEventListener('click', handleUserInteraction);
        document.removeEventListener('touchstart', handleUserInteraction);
    };
    
    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);
});
