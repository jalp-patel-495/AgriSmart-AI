import React from 'react';
import WeatherDashboard from '../WeatherDashboard';
import { useNavigate } from 'react-router-dom';

export default function FarmerWeather() {
  const navigate = useNavigate();

  return (
    <div className="role-page-container">
      <WeatherDashboard
        onNavigateToDiagnose={() => navigate('/farmer/disease-detection')}
      />
    </div>
  );
}
