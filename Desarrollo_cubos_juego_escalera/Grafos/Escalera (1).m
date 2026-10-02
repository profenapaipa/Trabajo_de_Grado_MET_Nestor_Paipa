%% Variables Iniciales n^2+2n n=numero de fichas.
NBE= 2;% Número Bloques Equipo
EstadoInicial=[1:NBE 0 NBE+1:2*NBE];
GrafoEscalera=[EstadoInicial 0]; MatrizMatlab=[];
%% Trucos de Hans
%MatrizMatlab=zeros(3780,22)
% Cambiar el concatenar
EstadosPendientes = 1; 
%% Generar Grafo
while (EstadosPendientes ~= 0)
    CEC=GrafoEscalera(:,end); % Ultima posición (Si ha sido visitado o no)
    PosicionEstadoConCero=find(CEC==0); % Encuentra 0s en la Matriz
    if isempty(PosicionEstadoConCero)
       EstadosPendientes = 1;
       break;
    end
    [NuevaCopiaEC] = GrafoEscalera(PosicionEstadoConCero(1,1),1:end-1);
    for P=1:4
        if P==1 % Accion 1 Mover 1 casilla a derecha
           NuevaCEC=NuevaCopiaEC;
           [MMatriz] = mover(NuevaCEC, 1);
           [MatrizMatlab] = NodosVertices(NuevaCEC, MMatriz, MatrizMatlab);
           [GrafoEscalera] = NuevoGrafo(MMatriz, GrafoEscalera);
        elseif P==2 % Accion 2 Mover 1 casilla a izquierda
           NuevaCEC=NuevaCopiaEC;
           [MMatriz] = mover(NuevaCEC, 2);
           [MatrizMatlab] = NodosVertices(NuevaCEC, MMatriz, MatrizMatlab);
           [GrafoEscalera] = NuevoGrafo(MMatriz, GrafoEscalera);
        elseif P==3 % Accion 3 Saltar 1 casilla a derecha
           NuevaCEC=NuevaCopiaEC;
           [SMatriz] = saltar(NuevaCEC, 1, NBE);
           [MatrizMatlab] = NodosVertices(NuevaCEC, SMatriz, MatrizMatlab);
           [GrafoEscalera] = NuevoGrafo(SMatriz, GrafoEscalera);
        elseif P==4 % Accion 4 Saltar 1 casilla a izquierda
           NuevaCEC=NuevaCopiaEC;
           [SMatriz] = saltar(NuevaCEC, 2, NBE);
           [MatrizMatlab] = NodosVertices(NuevaCEC, SMatriz, MatrizMatlab);
           [GrafoEscalera] = NuevoGrafo(SMatriz, GrafoEscalera);
        end
    end
    GrafoEscalera(PosicionEstadoConCero(1,1),end)=1;
end
%% Hallar la Frecuencia
%% Generar Grafo
[s,t] = IDNodos(GrafoEscalera, MatrizMatlab);
%MatrizA=[ID' num2str(Matriz1(:,1:end-1))];sourceTarget=[Matriz2 Matriz3];
G = graph(s,t);
h = plot(G,'Layout','force','WeightEffect','direct');
h.EdgeColor='black';
h.NodeColor='black';
%https://www.mathworks.com/help/matlab/ref/graph.shortestpath.html
path = shortestpath(G,1,26);
%highlight(h,path,'EdgeColor','red',"LineWidth",3)
%highlight(h,path)
labelnode(h,1,'1 Inicio')
labelnode(h,26,'26 Fin')
labelnode(h, 4, '4 [?][?][?][?][?]');
labelnode(h, 12, '12 [?][?][?][?][?]');
labelnode(h, 14, '14 [?][?][?][?][?]');
labelnode(h, 21, '21 [?][?][?][?][?]');
labelnode(h, 28, '28 [?][?][?][?][?]');
labelnode(h, 30, '30 [?][?][?][?][?]');
h.NodeLabelColor='black';
%set(gca,'color',[0 0 0])
%colormap jet
%colorbar
%title('Juego La Escalera - Exploración Autónoma')
%hold on
%% Funciones
% Levantar
function [MMatriz] = mover(MatrizB, lado)
    % Encontrar la posición de 0
    idx = find(MatrizB == 0);
    [~, B] = size(MatrizB);
    
    if isempty(idx) || (lado == 1 && (idx >= B || idx <= 1)) || (lado == 2 && idx >= B)
        MMatriz = MatrizB; % No es necesario realizar cambios si no se cumplen las condiciones
        return;
    end
    
    % Calcular el nuevo índice después del movimiento
    nuevoIdx = idx - 1 + (lado == 2) * 2;
    
    % Realizar el movimiento
    MatrizB([idx, nuevoIdx]) = MatrizB([nuevoIdx, idx]);
    
    MMatriz = MatrizB;
end
function [SMatriz] = saltar(MatrizB, lado, NB)
    idx = find(MatrizB == 0);
    [~, B] = size(MatrizB);
    MA = 1:NB;
    MB = NB + 1:NB * 2;

    if isempty(idx)
        SMatriz = MatrizB;  % No zeros found, no need to make changes
        return;
    end

    % Calculate new indices for blocks
    if lado == 1 && idx > 2  % Derecha
        idxBloque = idx - 2;
        idxBloqueDeSalto = idx - 1;
    elseif lado == 2 && idx < B - 2  % Izquierda
        idxBloque = idx + 2;
        idxBloqueDeSalto = idx + 1;
    else
        SMatriz = MatrizB;  % Invalid conditions, no need to make changes
        return;
    end

    % Check if blocks are in the correct groups
    Bloque = MatrizB(idxBloque);
    BloqueDeSalto = MatrizB(idxBloqueDeSalto);

    grupoCorrecto = (ismember(Bloque, MA) && ismember(BloqueDeSalto, MB)) || ...
                    (ismember(Bloque, MB) && ismember(BloqueDeSalto, MA));

    if grupoCorrecto
        % Perform the jump
        MatrizB([idxBloque, idx]) = MatrizB([idx, idxBloque]);
    end

    SMatriz = MatrizB;
end
function [MatrizMatlab] = NodosVertices(Matriz1, Matriz2, MatrizMatlab)
    [A,~]=size(MatrizMatlab);Comparar=1;
    if isequal(Matriz1, Matriz2)
        Comparar=0;
    else
        Matriz3 = [Matriz1 Matriz2];
        Matriz4 = [Matriz2 Matriz1];
        for j=1:A
            if isequal(Matriz3, MatrizMatlab(j,:)) || isequal(Matriz4, MatrizMatlab(j,:))
               Comparar=0;
            end
        end
    if Comparar==0
       MatrizMatlab=MatrizMatlab;
    elseif Comparar==1
           MatrizMatlab = cat(1,MatrizMatlab,Matriz3);
    end
    end
end
function [GrafoEscalera] = NuevoGrafo(Matriz1, Matriz2)
    [A,~]=size(Matriz2);
    Comparar=1;
    Matrizi=[Matriz1 0];
    for j=1:A
        if isequal(Matriz1, Matriz2(j,1:end-1))
           Comparar=0;
        end
    end
    if Comparar==0
       GrafoEscalera=Matriz2;
    elseif Comparar==1
       GrafoEscalera=cat(1,Matriz2,Matrizi);
    end
end
function [s,t] = IDNodos(Matriz1, Matriz2)
    [A,~]=size(Matriz1);
    [B,C]=size(Matriz2);
    s=[];t=[];
    for i=1:A
        Nodo = Matriz1(i,1:end-1);
        for j=1:B
            if isequal(Nodo, Matriz2(j,1:C/2))
                s(j,1) = i;
            end
            if isequal(Nodo, Matriz2(j,C/2+1:C))
                t(j,1) = i;
            end                        
        end
    end
end
function [Estados]=filtro_datos(Matriz)
    [A,~]=size(Matriz);
    Estados=[];
    for i=1:A
        C=Matriz(i,:);
        %Estado=str2double(regexp(num2str(C),'\d','match'));
        Estado=str2double(regexp(num2str(C, '%09.f'),'\d','match'));
        [~,N]=size(Estado);
        if N==9
            Estados=cat(1,Estados,Estado);
        end
    end
end
function [Frecuencia] = tablafrecuencia(Matriz1,Matriz2)
    Frecuencia=[];
    MatrizGrafo=Matriz2(:,1:9);
    [A,~]=size(Matriz2);
    [B,~]=size(Matriz1);
    for i=1:A
        frecuencia=0;
        for j=1:B
            if isequal(MatrizGrafo(i,:),Matriz1(j,:))
                frecuencia=frecuencia+1;
            end
        end
        F= [MatrizGrafo(i,:) frecuencia];
        Frecuencia = cat(1,Frecuencia,F);
    end
end