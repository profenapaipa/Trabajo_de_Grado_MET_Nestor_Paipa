% Fink, A., Rominger, C., Benedek, M., Perchtold, C. M., Papousek, I., Weiss, E. M., ... & Memmert, D. (2018). EEG alpha activity during imagining creative moves in soccer decision-making situations. Neuropsychologia, 114, 118-124.
% Configuración inicial
filenames = {'Sesión 1.txt', 'Sesión 2.txt'};
fs = 125; % Frecuencia de muestreo (Hz)
max_duration_samples = 100 * fs; % Máximo de 100 segundos en muestras
alpha_band = [8, 13]; % Banda alfa en Hz

% Definir los canales específicos según el artículo
channel_names = {'FP1', 'FP2', 'F7', 'F8', 'F3', 'F4', 'T7', 'T8', 'C3', 'C4', 'P7', 'P8', 'P3', 'P4', 'O1', 'O2'};
selected_channels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; % Índices de los canales

% Preparación de variables para almacenar los resultados
alpha_trp_per_channel = zeros(length(selected_channels), 2); % TRP alfa para cada canal y sesión

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

    % Asegurarse de que los datos son de tipo double y finitos
    eeg_data = double(eeg_data); % Convertir a double si es necesario
    eeg_data = eeg_data(~any(isnan(eeg_data) | isinf(eeg_data), 2), :); % Eliminar filas con NaN o Inf

    % Filtrar toda la sesión de datos (0.5-40 Hz)
    eeg_data = highpass(lowpass(eeg_data, 40, fs), 0.5, fs);

    % Calcular el intervalo de referencia (5 segundos al inicio)
    reference_interval = eeg_data(1:min(5*fs, end), :);

    % Calcular la potencia de referencia en banda alfa para cada canal
    reference_power = arrayfun(@(ch) bandpower(reference_interval(:, ch), fs, alpha_band), selected_channels);

    % Calcular TRP para cada canal
    for ch = 1:length(selected_channels)
        % Seleccionar el canal actual
        channel_data = eeg_data(:, selected_channels(ch));

        % Aplicar STFT con ventana de Hanning para calcular TRP
        window_size = 250; % Ventana de 250 ms (en muestras)
        overlap = 0.5 * window_size; % Superposición del 50%
        [s_power, f, ~] = stft(channel_data, fs, 'Window', hanning(window_size), 'OverlapLength', overlap, 'FFTLength', window_size);

        % Seleccionar potencia en banda alfa y calcular TRP para el canal
        alpha_indices = f >= alpha_band(1) & f <= alpha_band(2);
        alpha_power_task = mean(abs(s_power(alpha_indices, :)).^2, 1); % Potencia promedio en banda alfa
        trp_alpha = (log10(mean(alpha_power_task)) - log10(reference_power(ch))) / log10(reference_power(ch)); % Calcular TRP

        % Almacenar el TRP calculado para el canal y sesión actual
        alpha_trp_per_channel(ch, s) = trp_alpha;
    end
end

% Graficar TRP por canal para comparar ambas sesiones
figure;
plot(alpha_trp_per_channel, '-o', 'LineWidth', 1.5);
set(gca, 'XTickLabel', channel_names, 'XTick', 1:length(channel_names));
title('Comparación de TRP (Alfa) por Canal entre Sesión 1 y Sesión 2');
xlabel('Canales EEG');
ylabel('TRP (Alfa) [log \muV^2]');
legend('Sesión 1', 'Sesión 2');
grid on;
