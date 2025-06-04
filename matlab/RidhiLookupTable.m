
clear
tic

%% Fixed Material parameters
w_in = 19e-3;             % Width of insulator
fi_d = pi / 2;           % Angle of distributed load
fi_t = -pi / 2;          % Angle of end force
fibo = pi / 2;           % Angle of force

e_in = 4.7;              % Permittivity of insulator
t_in = 100e-6;           % Thickness of insulator
e_di = 2.7;              % Permittivity of liquid dielectric
e_air = 1;               % Permittivity of air
e_0 = 8.85e-12;          % Permittivity of vacuum (Fm-1)

%% Parameter ranges to vary
length_range = 20e-3:10e-3:70e-3;         % Starting with bigger steps for testing
width_range = 10e-3:5e-3:20e-3;           % Starting with bigger steps for testing  n 
thickness_range = 50e-6:50e-6:200e-6;     % Starting with bigger steps for testing
voltage_range = 5000:2000:9000;           % Starting with bigger steps for testing
youngs_modulus = 190e9;                   % 190 GPa (constant)

% Create a table to store results
results_table = table();
row = 1;

% Progress tracking
total_combinations = length(length_range) * length(width_range) * length(thickness_range) * length(voltage_range);
fprintf('Total parameter combinations to calculate: %d\n', total_combinations);
combination_count = 0;

%% Loop through all parameter combinations
for i_length = 1:length(length_range)
    Length_total = length_range(i_length);
    
    for i_width = 1:length(width_range)
        w = width_range(i_width);
        
        for i_thickness = 1:length(thickness_range)
            thickness = thickness_range(i_thickness);
            
            % Calculate beam stiffness based on current parameters
            % Using the beam formula: EI = Young's modulus * width * thickness^3 / 12
            EI = youngs_modulus * w * thickness^3 / 12;
            
            for i_voltage = 1:length(voltage_range)
                Voltage = voltage_range(i_voltage);
                
                % Update progress counter
                combination_count = combination_count + 1;
                fprintf('Calculating combination %d of %d (%.1f%%)\n', ...
                    combination_count, total_combinations, 100*combination_count/total_combinations);

                %% Calculation
                Height_different = 3e-3:2e-3:10e-3;
                FF_Height = zeros(1, length(Height_different));
                options = optimset('Display', 'off');  % Use optimset for fsolve

                for n_Height = 1:length(Height_different)
                    n_num = 50;
                    Height = zeros(1, n_num);
                    Length_q = 0;
                    OilLength = (Length_total - Length_q) * 0.1;
                    n_node = 100;
                    n_addnode = 0;
                    FF = zeros(1, 30);
                    Height_total = Height_different(n_Height);
                    flag = 0;
                    
                    for n = 1:50
                        for num = 1:n_num % Iteration
                            Mf = zeros(n_node, n_node);
                            Mq = zeros(n_node, n_node);
                            Mt = zeros(n_node, n_node);  % Matrix for total moment
                            theta = zeros(n_node, n_node);
                            dtheta = zeros(n_node, n_node);
                            
                            %% Determine initial force and moment
                            if num == 1 && n == 1      % Initial shape
                                L = Length_total;
                                theta2 = 0;
                                x0 = [0.5, 0.5, 0.1];  % Initial value
                                B = Height_total / L;  % y position

                                x = fsolve(@(x) BeamIntegral(x, B, EI, L, fibo, theta2), x0, options);
                                phi1 = real(x(1));
                                Force = real(x(3));  % End force
                                k = cos(fibo / 2) / sin(phi1);
                                phi2 = pi - asin(cos((fibo - theta2) / 2) / k);
                                F1 = ellipticF(phi1, k^2);
                                F2 = ellipticF(phi2, k^2);
                                E1 = ellipticE(phi1, k^2);
                                E2 = ellipticE(phi2, k^2);
                                alpha = (F2 - F1)^2;
                                angle = linspace(phi1, phi2, 50);
                                W = -1 / sqrt(alpha) * (2 * k * sin(fibo) * (cos(angle) - cos(phi1))) * L;
                                H = -1 / sqrt(alpha) * (sin(fibo) * (2 * ellipticE(angle, k^2) - 2 * E1 - ellipticF(angle, k^2) + F1)) * L;
                                S = sqrt(EI / Force) * (ellipticF(angle, k^2) - F1);

                                N = find(S > OilLength);
                                N = N(1);
                                Length_q = S(N);     % Initial length of oil zone
                                dl = Length_q / n_node;

                                q = zeros(n_node, 1);
                                F0 = Force;
                                M0 = 2 * k * sqrt(F0 * EI) * cos(phi1) - F0 * (W(end) - W(N));

                            elseif num == 1 && n > 1   % Oil moves to next position
                                q = cat(1, zeros(n_addnode, 1), q);
                                F0 = (Force + F0) / 2;
                                M0 = 2 * k * sqrt(F0 * EI) * cos(phi1) - F0 * W(N);
                            elseif num == n_num      % Reach maximum iteration then stop
                                flag = 2;
                                break
                            else                   % Iteration calculation
                                q = ones(n_node, 1) .* (0.5 * e_di * e_0 * w * Voltage^2 ./ (2 * abs(flip(Y)) + 2 * t_in * e_di / e_in).^2 + ...
                                    e_in * e_0 * w * Voltage^2 ./ (2 * abs(flip(Y)) * e_in / e_di + 2 * t_in).^2);
                                F0 = (Force + F0) / 2;
                                M0 = (Moment2 + M0) / 2;
                            end
                            
                            %% BGSA
                            for i = 1:n_node    % Number of nodes
                                if i == 1
                                    theta(i, i) = 0;
                                else
                                    Mf(i, i) = F0 * dl * sum(sin(fi_t - theta(1:(i-1), i-1)));  % Moment of force
                                    for m = 1:i-1
                                        if m == 1
                                            Mq(i, i) = Mq(i, i) + q(i - m) * dl^2 * sin(fi_d - theta(i - 1, i - 1));  % Moment of distributed load produced by previous nodes
                                        else
                                            Mq(i, i) = Mq(i, i) + q(i - m) * dl^2 * sum(sin(fi_d - theta(i - m:i - 1, i - 1)));  % Moment of distributed load produced by previous nodes
                                        end
                                    end
                                    % Sum matrices instead of assigning to a single element
                                    Mt = M0 + Mf + Mq;   % Add matrices together, update whole matrix
                                    dtheta(i, i) = Mt(i, i) / EI * dl;
                                    for j = 1:i-1                   % Angle correction for previous nodes
                                        theta(j, i) = theta(j, i - 1) + dtheta(i, i);
                                    end
                                    if theta(j, i) > 0               % Limit the upper boundary
                                        theta(j, i) = 0;
                                        theta(:, n_node) = theta(:, i);
                                        break
                                    end
                                end
                            end

                            X = cumsum(flip(cos(theta(:, n_node)))) * dl; % Calculation shape of oil-zone
                            Y = cumsum(flip(sin(theta(:, n_node)))) * dl;

                            %% Elliptic Integral
                            L = Length_total - Length_q;            % Length of non-oil zone
                            Height(num) = Height_total + Y(n_node); % Height of the end tip of non-oil zone
                            theta2 = -theta(1, n_node);
                            x0 = [0.5, 0.5, 0.1];   % Initial value
                            B = Height(num) / L;    % y position
                            [x, fval, exitflag, output] = fsolve(@(x) BeamIntegral(x, B, EI, L, fibo, theta2), x0, options);
                            phi1 = real(x(1));
                            k = cos(fibo / 2) / sin(phi1);
                            phi2 = pi - asin(cos((fibo - theta2) / 2) / k);
                            if exitflag ~= 1
                                flag = 1;
                                break
                            end
                            F1 = ellipticF(phi1, k^2);
                            F2 = ellipticF(phi2, k^2);
                            E1 = ellipticE(phi1, k^2);
                            E2 = ellipticE(phi2, k^2);
                            alpha = (F2 - F1)^2;
                            A = real(x(2));       % x position
                            Force = real(x(3));   % End force
                            Moment1 = 2 * k * sqrt(Force * EI) * cos(phi1);
                            Moment2 = 2 * k * sqrt(Force * EI) * cos(phi2);
                            if num > 1 && abs(1 - M0 / Moment2) < 1e-3 && abs(1 - F0 / Force) < 1e-3 && abs(1 - Height(num) / Height(num - 1)) < 1e-3 % If error small enough then stop
                                FF(n) = Force * 2;  % Total force
                                break
                            end
                        end
                        if flag == 1 || flag == 2
                            break
                        elseif n > 1 && abs(FF(n) / FF(n - 1) - 1) < 0.01 % If force change too small then stop
                            flag = 3;
                            break
                        end
                    end
                    if flag == 1 || flag == 2
                        if n > 1
                            FF_Height(n_Height) = FF(n - 1);
                        else
                            FF_Height(n_Height) = 0; % Default value if n is 1
                        end
                    elseif flag == 3
                        FF_Height(n_Height) = FF(n);
                    else
                        % If none of the flags are set, use a default value
                        FF_Height(n_Height) = 0;
                    end
                end
                
                % Store the results in our table
                results_table(row,:) = {Length_total*1000, w*1000, thickness*1e6, Voltage, FF_Height(end)};
                row = row + 1;
            end % voltage loop
        end % thickness loop
    end % width loop
end % length loop

% Set column names for the table
results_table.Properties.VariableNames = {'Length_mm', 'Width_mm', 'Thickness_um', 'Voltage_V', 'Force_N'};

% Save results to CSV and MAT file
writetable(results_table, 'beam_actuator_results.csv');
save('beam_actuator_results.mat', 'results_table');

fprintf('Calculation completed and results saved.\n');
toc

%% Plot
figure
plot(Height_different * 2e3, FF_Height)
xlabel('Extension (mm)')
ylabel('Contractile force (N)')
title('Extension - Force (Last Parameter Set)')
grid on

%% Plot example slices of the data
figure;
subset = results_table(results_table.Width_mm == width_range(1)*1000 & ...
                       results_table.Thickness_um == thickness_range(1)*1e6 & ...
                       results_table.Voltage_V == voltage_range(1), :);
plot(subset.Length_mm, subset.Force_N, 'o-');
xlabel('Length (mm)');
ylabel('Force (N)');
title('Force vs Length (fixed width, thickness, voltage)');
grid on;

%% BGSA_Elliptic_OilLength_Force Function
function [force, extension] = computeForceExtension(EI, beamLength, voltage)
    % computeForceExtension calculates the force and extension of the actuator
    % based on the input material properties, beam length, and voltage.

    % Example simplified force and extension calculation (replace with your actual model)
    % You need to replace this with your model's real calculations.
    
    % Assuming the force calculation depends on beam stiffness (EI), length, and voltage
    force = EI * beamLength * voltage;  % Example force calculation
    extension = force / EI;             % Example extension calculation (simplified)
end