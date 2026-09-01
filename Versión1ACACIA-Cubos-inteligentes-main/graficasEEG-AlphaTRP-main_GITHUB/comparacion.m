% Liang, Y., Liu, X., Qiu, L., & Zhang, S. (2018). An EEG Study of a Confusing State Induced by Information Insufficiency during Mathematical Problem‐Solving and Reasoning. Computational Intelligence and Neuroscience, 2018(1), 1943565.
% Configuración inicial
filenames = {'Sesión 1.txt', 'Sesión 2.txt'};
fs = 125; % Frecuencia de muestreo (Hz)
max_duration_samples = 100 * fs; % Máximo de 100 segundos en muestras
alpha_band = [8, 13]; % Banda alfa en Hz

% Preparación de variables para almacenar los resultados
alpha_trp_session = cell(1, 2); % TRP alfa para cada sesión
time_sessions = cell(1, 2); % Tiempos correspondientes para cada sesión

% Iterar sobre las dos sesiones
for s = 1:2
    % Cargar datos
    opts = detectImportOptions(filenames{s});
    opts.DataLines = [4 Inf];
    data = readtable(filenames{s}, opts);
    eeg_data = table2array(data(:, 2:17)); % Canales EEG
    
    % Limitar a los primeros 100 segundos o la cantidad de datos disponibles
    max_samples = min(size(eeg_data, 1), max_duration_samples);
    eeg_data = eeg_data(1:max_samples, :);
    
    % Asegurarse de que todos los datos son numéricos y finitos
    eeg_data = eeg_data(~any(isnan(eeg_data) | isinf(eeg_data), 2), :);
    
    % Filtrar toda la sesión de datos (0.5-40 Hz)
    eeg_data = highpass(lowpass(eeg_data, 40, fs), 0.5, fs);
    
    % Calcular el intervalo de referencia (1 segundo al inicio)
    reference_interval = eeg_data(1:fs, :);
    reference_power = bandpower(reference_interval(:, 1), fs, alpha_band);
    
    % Aplicar STFT con ventana de Hanning para calcular TRP
    window_size = 250; % Ventana de 250 ms (en muestras)
    overlap = 0.5 * window_size; % Superposición del 50%
    [s_power, f, t] = stft(eeg_data(:,1), fs, 'Window', hanning(window_size), 'OverlapLength', overlap, 'FFTLength', window_size);
    
    % Seleccionar potencia en banda alfa y calcular TRP
    alpha_indices = f >= alpha_band(1) & f <= alpha_band(2);
    alpha_power_task = mean(abs(s_power(alpha_indices, :)).^2, 1); % Potencia promedio en banda alfa
    trp_alpha = log10(alpha_power_task) - log10(reference_power); % Calcular TRP
    
    % Suavizar TRP (usando una ventana de media móvil de 10 puntos)
    smoothed_trp_alpha = movmean(trp_alpha, 30);

    % Almacenar resultados de TRP suavizados y tiempo
    alpha_trp_session{s} = smoothed_trp_alpha;

    % Almacenar resultados de TRP y tiempo
    alpha_trp_session{s} = trp_alpha;
    time_sessions{s} = t; % Vector de tiempo del STFT
end

% Realizar ANOVA para comparar las dos sesiones
alpha_trp_combined = [alpha_trp_session{1}'; alpha_trp_session{2}'];
group = [ones(length(alpha_trp_session{1}), 1); 2 * ones(length(alpha_trp_session{2}), 1)];
[p, tbl, stats] = anova1(alpha_trp_combined, group);
title('ANOVA de TRP Alfa entre Sesión 1 y Sesión 2');
fprintf('p-valor del ANOVA: %f\n', p);

% Graficar Time vs TRP (Alpha) [log μV^2] para comparar ambas sesiones
figure;
plot(time_sessions{1}, alpha_trp_session{1}, 'b', 'LineWidth', 1.5);
hold on;
plot(time_sessions{2}, alpha_trp_session{2}, 'r', 'LineWidth', 1.5);
title('Comparación de TRP (Alpha) entre Sesión 1 y Sesión 2 (Primeros 100 segundos)');
xlabel('Tiempo (s)');
ylabel('TRP (Alpha) [log \muV^2]');
legend('Sesión 1', 'Sesión 2');
grid on;
