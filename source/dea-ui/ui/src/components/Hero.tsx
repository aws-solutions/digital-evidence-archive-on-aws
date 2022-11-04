/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

import { useSettings } from '../context/SettingsContext';
import styles from '../styles/Hero.module.scss';

function Hero(): JSX.Element {
  const { settings } = useSettings();

  return (
    <div className="custom-home__header">
      Hello {settings.name}!<button className={styles.primaryButton}>Go to dashboard</button>
    </div>
  );
}

export default Hero;
