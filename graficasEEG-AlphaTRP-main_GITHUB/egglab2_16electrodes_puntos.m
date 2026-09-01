% Ruta al archivo de localización de electrodos
loc_file = 'eeglab_current\eeglab2024.2\sample_locs\Standard-10-20-16OPENBCI.locs';

% Cargar archivo de localización de electrodos
eeglab; % Iniciar EEGLab si es necesario
locs = readlocs(loc_file);

% Asegurarse de que solo se usen los 16 electrodos disponibles
if length(locs) > 16
    locs = locs(1:16); % Tomar solo los primeros 16 canales si hay más
end

% Rango ajustado automáticamente si los datos están fuera de los límites definidos
actual_range = [min(alpha_trp_per_channel(:)), max(alpha_trp_per_channel(:))];

% Verifica si el rango definido se ajusta a los datos
if actual_range(1) < range_limits(1) || actual_range(2) > range_limits(2)
    range_limits = actual_range; % Ajustar los límites al rango real
end

% Graficar mapas para cada sesión
for s = 1:size(alpha_trp_per_channel, 2)
    figure;
    set(gcf, 'Position', [100, 100, 700, 700]); % Tamaño de la figura ajustado
    
    % Graficar el mapa topográfico con puntos
    topoplot(alpha_trp_per_channel(:, s), locs, 'maplimits', range_limits, ...
             'electrodes', 'on', 'plotchans', 1:16); % Mostrar solo puntos
             
    % Títulos actualizados
    if s == 1
        title('Sesión 1 - Multiplicación por 1 cifra');
    else
        title('Sesión 2 - Multiplicación por 2 cifras');
    end
    
    % Barra de color
    col = colorbar;
    col.Label.String = 'TRP [log\muV^2]';
    col.Label.FontSize = 12;
    col.Label.FontWeight = 'bold';
end

% Graficar la diferencia entre sesiones
figure;
set(gcf, 'Position', [100, 100, 700, 700]); % Tamaño de la figura ajustado

% Graficar el mapa topográfico con puntos
topoplot(diff_trp, locs, 'maplimits', range_limits, ...
         'electrodes', 'on', 'plotchans', 1:16); % Mostrar solo puntos

% Título para la diferencia entre sesiones
title('Diferencia entre Sesión 1 y Sesión 2');

% Barra de color
col = colorbar;
col.Label.String = 'TRP [log\muV^2]';
col.Label.FontSize = 12;
col.Label.FontWeight = 'bold';
