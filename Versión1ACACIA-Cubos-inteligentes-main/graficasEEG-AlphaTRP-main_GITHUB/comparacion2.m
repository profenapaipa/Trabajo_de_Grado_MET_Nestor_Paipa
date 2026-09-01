% Configuración inicial
filenames = {'Sesión 1.txt', 'Sesión 2.txt'};
fs = 125; % Frecuencia de muestreo (Hz)
analysis_duration = 3 * fs; % Analizar los primeros 10 segundos
alpha_band = [8, 13]; % Banda alfa
channel_labels = {'T4', 'O1'}; % Canales de interés
channel_indices = [4, 10]; % Índices correspondientes (ajusta según tus datos)

% Almacenar TRP y tiempo
trp_sessions = cell(2, length(channel_indices));
time_sessions = cell(2, length(channel_indices));

% Iterar por las sesiones
for s = 1:2
    % Cargar datos
    opts = detectImportOptions(filenames{s});
    opts.DataLines = [4 Inf];
    data = readtable(filenames{s}, opts);
    eeg_data = table2array(data(:, 2:17)); % Extraer canales EEG

    % Limitar los datos a los primeros 10 segundos
    eeg_data = eeg_data(1:min(size(eeg_data, 1), analysis_duration), :);

    % Limpiar datos: eliminar valores no válidos (NaN, Inf)
    eeg_data = eeg_data(~any(isnan(eeg_data) | isinf(eeg_data), 2), :);

    % Verificar si los datos están vacíos después de la limpieza
    if isempty(eeg_data)
        error('Los datos están vacíos después de eliminar valores no válidos.');
    end

    % Filtrar para limpiar ruido (0.5-40 Hz)
    eeg_data = highpass(lowpass(eeg_data, 40, fs), 0.5, fs);

    % Iterar por los canales de interés
    for c = 1:length(channel_indices)
        channel_data = eeg_data(:, channel_indices(c));
        
        % Calcular potencia de referencia (primer segundo)
        reference_duration = fs; % 1 segundo para referencia
        reference_interval = channel_data(1:reference_duration);
        [pxx_ref, f_ref] = pwelch(reference_interval, hanning(fs), fs/2, fs, fs);
        alpha_indices_ref = f_ref >= alpha_band(1) & f_ref <= alpha_band(2);
        reference_power = trapz(f_ref(alpha_indices_ref), pxx_ref(alpha_indices_ref));

        % STFT para obtener potencia por frecuencia y tiempo
        window_size = round(0.25 * fs); % Ventana de 250 ms
        overlap = round(window_size / 2); % Superposición del 50%
        [s_power, f, t] = stft(channel_data, fs, 'Window', hanning(window_size), ...
            'OverlapLength', overlap, 'FFTLength', window_size);
        
        % Extraer potencia en banda alfa
        alpha_indices = f >= alpha_band(1) & f <= alpha_band(2);
        alpha_power_task = mean(abs(s_power(alpha_indices, :)).^2, 1);

        % Calcular TRP
        trp_alpha = log10(alpha_power_task) - log10(reference_power);
        
        % Guardar resultados
        trp_sessions{s, c} = trp_alpha;
        time_sessions{s, c} = t;
    end
end

% Gráfica de comparación
figure;
for c = 1:length(channel_indices)
    subplot(1, length(channel_indices), c);
    hold on;
    plot(time_sessions{1, c}, trp_sessions{1, c}, 'b-', 'LineWidth', 1.5, 'DisplayName', 'Sesión 1');
    plot(time_sessions{2, c}, trp_sessions{2, c}, 'r-', 'LineWidth', 1.5, 'DisplayName', 'Sesión 2');
    title(['TRP en Canal ', channel_labels{c}, ' (10 segundos)']);
    xlabel('Tiempo (s)');
    ylabel('TRP (log \muV^2)');
    legend('show');
    grid on;
end
